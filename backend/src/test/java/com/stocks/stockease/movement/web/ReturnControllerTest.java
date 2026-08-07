package com.stocks.stockease.movement.web;

import static com.stocks.stockease.movement.web.MovementTestFixtures.applicationJson;
import static com.stocks.stockease.movement.web.MovementTestFixtures.csrfToken;
import static com.stocks.stockease.movement.web.MovementTestFixtures.returnBody;

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
import com.stocks.stockease.movement.RecordMovementCommand;
import com.stocks.stockease.movement.StockMovementService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.UserService;
import com.stocks.stockease.shared.InvoiceStateException;

import jakarta.persistence.EntityNotFoundException;

/** Slice tests for POST /api/returns, the endpoint that records both return directions. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ReturnController.class)
@Import({TestConfig.class, MovementMethodSecurityTestConfig.class})
class ReturnControllerTest {

    private static final String POLICY_MESSAGE = "This endpoint records returns only.";

    @MockitoBean
    private StockMovementService stockMovementService;

    @MockitoBean
    private UserService userService;

    @Autowired
    private MockMvc mockMvc;

    @SuppressWarnings("unused") // invoked by JUnit via reflection, not by direct call
    @BeforeEach
    void setUpMocks() {
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(stockMovementService, userService);
        Mockito.when(userService.findByUsername("admin"))
                .thenReturn(Optional.of(new User("admin", "hash", "ROLE_ADMIN")));
    }

    @ParameterizedTest
    @ValueSource(strings = {"RETURN_FROM_CUSTOMER", "RETURNED_TO_SUPPLIER"})
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void registerReturn_withEitherReturnDirection_mapsRequestToCommand(String reason) throws Exception {
        MovementReason returnReason = MovementReason.valueOf(reason);
        Mockito.when(stockMovementService.recordMovement(any(RecordMovementCommand.class), any(User.class)))
                .thenReturn(MovementTestFixtures.movement(returnReason, 4L));

        mockMvc.perform(post("/api/returns").contentType(applicationJson())
                        .content(returnBody(returnReason)).with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.reason").value(reason))
                .andExpect(jsonPath("$.invoiceItemId").value(4));

        assertCapturedCommand(returnReason);
    }

    /** Asserts the command carries the invoice link, the stated product and no unit cost. */
    private void assertCapturedCommand(MovementReason reason) {
        ArgumentCaptor<RecordMovementCommand> command = ArgumentCaptor.forClass(RecordMovementCommand.class);
        ArgumentCaptor<User> user = ArgumentCaptor.forClass(User.class);
        Mockito.verify(stockMovementService).recordMovement(command.capture(), user.capture());

        assertThat(command.getValue().invoiceItemId()).isEqualTo(4L);
        assertThat(command.getValue().productId()).isEqualTo(3L);
        assertThat(command.getValue().reason()).isEqualTo(reason);
        assertThat(command.getValue().quantity()).isEqualTo(2);
        assertThat(command.getValue().unitCost()).isNull();
        assertThat(user.getValue().getUsername()).isEqualTo("admin");
    }

    @ParameterizedTest
    @ValueSource(strings = {"SOLD", "PURCHASE", "LOST", "DESTROYED"})
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void registerReturn_withNonReturnReason_returns400(String reason) throws Exception {
        mockMvc.perform(post("/api/returns").contentType(applicationJson())
                        .content(returnBody(MovementReason.valueOf(reason))).with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(POLICY_MESSAGE));

        verifyServiceNeverCalled();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"productId\": 3, \"reason\": \"RETURN_FROM_CUSTOMER\", \"quantity\": 2}",
            "{\"invoiceItemId\": 4, \"reason\": \"RETURN_FROM_CUSTOMER\", \"quantity\": 2}",
            "{\"invoiceItemId\": 4, \"productId\": 3, \"quantity\": 2}",
            "{\"invoiceItemId\": 4, \"productId\": 3, \"reason\": \"RETURN_FROM_CUSTOMER\", \"quantity\": 0}"})
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void registerReturn_withInvalidBody_returns400(String body) throws Exception {
        mockMvc.perform(post("/api/returns").contentType(applicationJson())
                        .content(body).with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for request parameters."));

        verifyServiceNeverCalled();
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void registerReturn_exceedingReturnableQuantity_returns409() throws Exception {
        Mockito.when(stockMovementService.recordMovement(any(RecordMovementCommand.class), any(User.class)))
                .thenThrow(new InvoiceStateException(
                        "Return of 2 exceeds remaining returnable quantity 1 for invoice item 4."));

        performExpecting(409, "Return of 2 exceeds remaining returnable quantity 1 for invoice item 4.");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void registerReturn_withUnknownInvoiceItem_returns404() throws Exception {
        Mockito.when(stockMovementService.recordMovement(any(RecordMovementCommand.class), any(User.class)))
                .thenThrow(new EntityNotFoundException("Invoice item with ID 4 not found."));

        performExpecting(404, "Entity not found: Invoice item with ID 4 not found.");
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void registerReturn_asUserRole_returns200() throws Exception {
        Mockito.when(userService.findByUsername("user"))
                .thenReturn(Optional.of(new User("user", "hash", "ROLE_USER")));
        Mockito.when(stockMovementService.recordMovement(any(RecordMovementCommand.class), any(User.class)))
                .thenReturn(MovementTestFixtures.movement(MovementReason.RETURN_FROM_CUSTOMER, 4L));

        mockMvc.perform(post("/api/returns").contentType(applicationJson())
                        .content(returnBody(MovementReason.RETURN_FROM_CUSTOMER)).with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceItemId").value(4));
    }

    @Test
    void registerReturn_asAnonymous_returns401() throws Exception {
        mockMvc.perform(post("/api/returns").contentType(applicationJson())
                        .content(returnBody(MovementReason.RETURN_FROM_CUSTOMER)).with(csrfToken()))
                .andExpect(status().isUnauthorized());

        verifyServiceNeverCalled();
    }

    /** Posts a valid customer-return body and expects the given status and envelope message. */
    private void performExpecting(int status, String message) throws Exception {
        mockMvc.perform(post("/api/returns").contentType(applicationJson())
                        .content(returnBody(MovementReason.RETURN_FROM_CUSTOMER)).with(csrfToken()))
                .andExpect(status().is(status))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(message));
    }

    private void verifyServiceNeverCalled() {
        Mockito.verify(stockMovementService, Mockito.never())
                .recordMovement(any(RecordMovementCommand.class), any(User.class));
    }
}
