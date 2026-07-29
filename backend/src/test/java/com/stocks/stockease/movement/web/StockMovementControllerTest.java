package com.stocks.stockease.movement.web;

import static com.stocks.stockease.movement.web.MovementTestFixtures.applicationJson;
import static com.stocks.stockease.movement.web.MovementTestFixtures.csrfToken;
import static com.stocks.stockease.movement.web.MovementTestFixtures.movementBody;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.movement.MovementReason;
import com.stocks.stockease.movement.MovementRemark;
import com.stocks.stockease.movement.RecordMovementCommand;
import com.stocks.stockease.movement.StockMovementService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.UserService;
import com.stocks.stockease.shared.InsufficientStockException;
import com.stocks.stockease.shared.InvalidMovementException;

import jakarta.persistence.EntityNotFoundException;

/** Slice tests for POST /api/stock-movements, including the reasons the API surface refuses. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(StockMovementController.class)
@Import({TestConfig.class, MovementMethodSecurityTestConfig.class})
class StockMovementControllerTest {

    private static final String POLICY_MESSAGE =
            "PURCHASE and SOLD movements exist only through invoice closing; returns use the return endpoint.";

    @MockitoBean
    private StockMovementService stockMovementService;

    @MockitoBean
    private UserService userService;

    @Autowired
    private MockMvc mockMvc;

    @SuppressWarnings("unused")
    @BeforeEach
    void setUpMocks() {
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(stockMovementService, userService);
        Mockito.when(userService.findByUsername("admin"))
                .thenReturn(Optional.of(new User("admin", "hash", "ROLE_ADMIN")));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void recordMovement_withLostReason_mapsRequestToCommand() throws Exception {
        Mockito.when(stockMovementService.recordMovement(any(RecordMovementCommand.class), any(User.class)))
                .thenReturn(MovementTestFixtures.movement(MovementReason.LOST, null, MovementRemark.EXPIRED));

        mockMvc.perform(post("/api/stock-movements").contentType(applicationJson())
                        .content(movementBody(MovementReason.LOST)).with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.productId").value(3))
                .andExpect(jsonPath("$.userId").value(11))
                .andExpect(jsonPath("$.type").value("DECREASE"))
                .andExpect(jsonPath("$.invoiceItemId").doesNotExist());

        assertCapturedCommand();
    }

    /** Asserts the command carries the request's fields, no invoice link, no price, and the principal. */
    private void assertCapturedCommand() {
        ArgumentCaptor<RecordMovementCommand> command = ArgumentCaptor.forClass(RecordMovementCommand.class);
        ArgumentCaptor<User> user = ArgumentCaptor.forClass(User.class);
        Mockito.verify(stockMovementService).recordMovement(command.capture(), user.capture());

        assertThat(command.getValue().productId()).isEqualTo(3L);
        assertThat(command.getValue().reason()).isEqualTo(MovementReason.LOST);
        assertThat(command.getValue().quantity()).isEqualTo(2);
        // the endpoint accepts no price at all now: whatever a client sends, the command carries none
        assertThat(command.getValue().unitCost()).isNull();
        assertThat(command.getValue().invoiceItemId()).isNull();
        assertThat(user.getValue().getUsername()).isEqualTo("admin");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void recordMovement_withLostReason_returns200() throws Exception {
        Mockito.when(stockMovementService.recordMovement(any(RecordMovementCommand.class), any(User.class)))
                .thenReturn(MovementTestFixtures.movement(MovementReason.LOST, null));

        mockMvc.perform(post("/api/stock-movements").contentType(applicationJson())
                        .content(movementBody(MovementReason.LOST)).with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("DECREASE"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void recordMovement_lostWithRemark_passesItThroughAndReturnsItInTheResponse() throws Exception {
        Mockito.when(stockMovementService.recordMovement(any(RecordMovementCommand.class), any(User.class)))
                .thenReturn(MovementTestFixtures.movement(MovementReason.LOST, null, MovementRemark.EXPIRED));

        mockMvc.perform(post("/api/stock-movements").contentType(applicationJson())
                        .content("{\"productId\": 3, \"reason\": \"LOST\", \"quantity\": 2, \"remark\": \"EXPIRED\"}")
                        .with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.remark").value("EXPIRED"))
                // the rest of the response shape is unchanged by the new key
                .andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.reason").value("LOST"));

        ArgumentCaptor<RecordMovementCommand> command = ArgumentCaptor.forClass(RecordMovementCommand.class);
        Mockito.verify(stockMovementService).recordMovement(command.capture(), any(User.class));
        assertThat(command.getValue().remark()).isEqualTo(MovementRemark.EXPIRED);
    }

    @ParameterizedTest
    @ValueSource(strings = {"NEW_PRODUCT", "OPENING_BALANCE"})
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void recordMovement_withRetiredOrUnknownReason_returns400(String reason) throws Exception {
        // NEW_PRODUCT is gone from the enum (ADR 021), so it no longer deserializes and never reaches
        // the policy check. The status is the contract here; the message is Jackson's, not ours.
        mockMvc.perform(post("/api/stock-movements").contentType(applicationJson())
                        .content("{\"productId\": 3, \"reason\": \"" + reason + "\", \"quantity\": 2}")
                        .with(csrfToken()))
                .andExpect(status().isBadRequest());

        verifyServiceNeverCalled();
    }

    @ParameterizedTest
    @ValueSource(strings = {"PURCHASE", "SOLD", "RETURN_FROM_CUSTOMER", "RETURNED_TO_SUPPLIER"})
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void recordMovement_withReasonOwnedByAnotherFlow_returns400(String reason) throws Exception {
        mockMvc.perform(post("/api/stock-movements").contentType(applicationJson())
                        .content(movementBody(MovementReason.valueOf(reason))).with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(POLICY_MESSAGE));

        verifyServiceNeverCalled();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"reason\": \"LOST\", \"quantity\": 2}",
            "{\"productId\": 3, \"quantity\": 2}",
            "{\"productId\": 3, \"reason\": \"LOST\", \"quantity\": 0}",
            "{\"productId\": 3, \"reason\": \"LOST\", \"quantity\": -2, \"remark\": \"EXPIRED\"}"})
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void recordMovement_withInvalidBody_returns400(String body) throws Exception {
        mockMvc.perform(post("/api/stock-movements").contentType(applicationJson())
                        .content(body).with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for request parameters."));

        verifyServiceNeverCalled();
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void recordMovement_whenServiceRejectsMovement_returns400() throws Exception {
        Mockito.when(stockMovementService.recordMovement(any(RecordMovementCommand.class), any(User.class)))
                .thenThrow(new InvalidMovementException("LOST and DESTROYED movements require a remark."));

        performExpecting(400, "LOST and DESTROYED movements require a remark.");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void recordMovement_whenStockWouldGoNegative_returns409() throws Exception {
        Mockito.when(stockMovementService.recordMovement(any(RecordMovementCommand.class), any(User.class)))
                .thenThrow(new InsufficientStockException(
                        "Adjustment of -2 would result in negative stock for product 3 (current: 1)."));

        performExpecting(409, "Adjustment of -2 would result in negative stock for product 3 (current: 1).");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void recordMovement_withUnknownProduct_returns404() throws Exception {
        Mockito.when(stockMovementService.recordMovement(any(RecordMovementCommand.class), any(User.class)))
                .thenThrow(new EntityNotFoundException("Product with ID 3 not found."));

        performExpecting(404, "Entity not found: Product with ID 3 not found.");
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void recordMovement_asUserRole_returns200() throws Exception {
        Mockito.when(userService.findByUsername("user"))
                .thenReturn(Optional.of(new User("user", "hash", "ROLE_USER")));
        Mockito.when(stockMovementService.recordMovement(any(RecordMovementCommand.class), any(User.class)))
                .thenReturn(MovementTestFixtures.movement(MovementReason.DESTROYED, null));

        mockMvc.perform(post("/api/stock-movements").contentType(applicationJson())
                        .content(movementBody(MovementReason.DESTROYED)).with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reason").value("DESTROYED"));
    }

    @Test
    void recordMovement_asAnonymous_returns401() throws Exception {
        mockMvc.perform(post("/api/stock-movements").contentType(applicationJson())
                        .content(movementBody(MovementReason.LOST)).with(csrfToken()))
                .andExpect(status().isUnauthorized());

        verifyServiceNeverCalled();
    }

    /** Posts a valid LOST body and expects the given status and envelope message from the handler. */
    private void performExpecting(int status, String message) throws Exception {
        mockMvc.perform(post("/api/stock-movements").contentType(applicationJson())
                        .content(movementBody(MovementReason.LOST)).with(csrfToken()))
                .andExpect(status().is(status))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(message));
    }

    private void verifyServiceNeverCalled() {
        Mockito.verify(stockMovementService, Mockito.never())
                .recordMovement(any(RecordMovementCommand.class), any(User.class));
    }
}
