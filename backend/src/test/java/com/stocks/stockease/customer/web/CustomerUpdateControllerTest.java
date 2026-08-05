package com.stocks.stockease.customer.web;

import java.time.LocalDateTime;
import java.util.Objects;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.customer.Customer;
import com.stocks.stockease.customer.CustomerService;

import jakarta.persistence.EntityNotFoundException;

/**
 * Slice tests for PUT /api/customers/{id} (customer update).
 *
 * <p>The supplier's update slice next door is the structural mirror. The one contract difference is
 * asserted rather than assumed: a customer needs a name and nothing else, so a body with no address
 * is valid here where the supplier's would be a 400.
 */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(CustomerController.class)
@Import({TestConfig.class, CustomerMethodSecurityTestConfig.class})
class CustomerUpdateControllerTest {

    @MockitoBean
    private CustomerService customerService;

    @Autowired
    private MockMvc mockMvc;

    private Customer updated;

    @SuppressWarnings("unused")
    @BeforeEach
    void setUpMocks() {
        updated = new Customer(1L, "Jane Roe", null, null, null, null, LocalDateTime.of(2026, 1, 2, 3, 4), null);
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(customerService);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void updateCustomer_withValidData_returnsEnvelope() throws Exception {
        Mockito.when(customerService.update(anyLong(), anyString(), Mockito.isNull(), Mockito.isNull(),
                Mockito.isNull(), Mockito.isNull())).thenReturn(updated);

        mockMvc.perform(put("/api/customers/1")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Jane Roe\"}")
                        .with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Customer updated successfully"))
                .andExpect(jsonPath("$.data.name").value("Jane Roe"));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void updateCustomer_asUserRole_returns200() throws Exception {
        Mockito.when(customerService.update(anyLong(), anyString(), Mockito.isNull(), Mockito.isNull(),
                Mockito.isNull(), Mockito.isNull())).thenReturn(updated);

        mockMvc.perform(put("/api/customers/1")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Jane Roe\"}")
                        .with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Jane Roe"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void updateCustomer_withMissingId_returns404() throws Exception {
        Mockito.when(customerService.update(anyLong(), anyString(), Mockito.isNull(), Mockito.isNull(),
                Mockito.isNull(), Mockito.isNull()))
                .thenThrow(new EntityNotFoundException("Customer with ID 9 not found."));

        mockMvc.perform(put("/api/customers/9")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Jane Roe\"}")
                        .with(csrfToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Entity not found: Customer with ID 9 not found."));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void updateCustomer_withBlankName_returns400() throws Exception {
        mockMvc.perform(put("/api/customers/1")
                        .contentType(applicationJson())
                        .content("{\"name\": \"\"}")
                        .with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.name").value("Customer name is required."));

        Mockito.verify(customerService, Mockito.never()).update(anyLong(), any(), any(), any(), any(), any());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void updateCustomer_withoutAnAddress_isAcceptedUnlikeTheSupplier() throws Exception {
        // The contract difference this endpoint mirrors the CUSTOMER's create rules for, rather than
        // the supplier's: address is optional here, so the body above is complete, not truncated.
        Mockito.when(customerService.update(anyLong(), anyString(), anyString(), Mockito.isNull(),
                Mockito.isNull(), Mockito.isNull())).thenReturn(updated);

        mockMvc.perform(put("/api/customers/1")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Jane Roe\", \"email\": \"jane@example.com\"}")
                        .with(csrfToken()))
                .andExpect(status().isOk());

        Mockito.verify(customerService).update(1L, "Jane Roe", "jane@example.com", null, null, null);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void updateCustomer_withContactFields_passesThemThroughAndReturnsThem() throws Exception {
        Mockito.when(customerService.update(1L, "Jane Roe", "roe@example.com", "555-9999", "2 Side St",
                        "Shelbyville"))
                .thenReturn(new Customer(1L, "Jane Roe", "roe@example.com", "555-9999", "2 Side St", "Shelbyville",
                        LocalDateTime.of(2026, 1, 2, 3, 4), null));

        mockMvc.perform(put("/api/customers/1")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Jane Roe\", \"email\": \"roe@example.com\", \"phone\": \"555-9999\","
                                + " \"address\": \"2 Side St\", \"city\": \"Shelbyville\"}")
                        .with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("roe@example.com"))
                .andExpect(jsonPath("$.data.phone").value("555-9999"))
                .andExpect(jsonPath("$.data.address").value("2 Side St"))
                .andExpect(jsonPath("$.data.city").value("Shelbyville"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void updateCustomer_omittingContactFields_passesNullsToTheService() throws Exception {
        // Wholesale replace: a body that leaves the optional fields out is asking for them to be
        // cleared, so the service must be called with nulls rather than with the stored values.
        Mockito.when(customerService.update(anyLong(), anyString(), Mockito.isNull(), Mockito.isNull(),
                Mockito.isNull(), Mockito.isNull())).thenReturn(updated);

        mockMvc.perform(put("/api/customers/1")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Jane Roe\"}")
                        .with(csrfToken()))
                .andExpect(status().isOk());

        Mockito.verify(customerService).update(1L, "Jane Roe", null, null, null, null);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void updateCustomer_withMalformedEmail_returns400() throws Exception {
        mockMvc.perform(put("/api/customers/1")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Jane Roe\", \"email\": \"nope\"}")
                        .with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.email").value("Customer email must be a valid email address."));

        Mockito.verify(customerService, Mockito.never()).update(anyLong(), any(), any(), any(), any(), any());
    }

    @Test
    void updateCustomer_asAnonymous_returns401() throws Exception {
        mockMvc.perform(put("/api/customers/1")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Jane Roe\"}")
                        .with(csrfToken()))
                .andExpect(status().isUnauthorized());
    }

    private static @NonNull MediaType applicationJson() {
        return Objects.requireNonNull(MediaType.APPLICATION_JSON);
    }

    private static @NonNull RequestPostProcessor csrfToken() {
        return Objects.requireNonNull(csrf());
    }
}
