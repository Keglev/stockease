package com.stocks.stockease.customer.web;

import java.util.Objects;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.anyLong;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.customer.CustomerService;
import com.stocks.stockease.shared.EntityInUseException;

import jakarta.persistence.EntityNotFoundException;

/** Slice tests for DELETE /api/customers/{id}, covering the admin-only rule and the open-invoice veto. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(CustomerController.class)
@Import({TestConfig.class, CustomerMethodSecurityTestConfig.class})
class CustomerDeleteControllerTest {

    @MockitoBean
    private CustomerService customerService;

    @Autowired
    private MockMvc mockMvc;

    @SuppressWarnings("unused")
    @BeforeEach
    void setUpMocks() {
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(customerService);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void deleteCustomer_asAdmin_returns200() throws Exception {
        mockMvc.perform(delete("/api/customers/1").with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Customer with ID 1 has been successfully deleted."));

        Mockito.verify(customerService, Mockito.times(1)).deleteById(1L);
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void deleteCustomer_asUserRole_returns403() throws Exception {
        mockMvc.perform(delete("/api/customers/1").with(csrfToken()))
                .andExpect(status().isForbidden());

        Mockito.verify(customerService, Mockito.never()).deleteById(anyLong());
    }

    @Test
    void deleteCustomer_asAnonymous_returns401() throws Exception {
        mockMvc.perform(delete("/api/customers/1").with(csrfToken()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void deleteCustomer_withMissingId_returns404() throws Exception {
        Mockito.doThrow(new EntityNotFoundException("Customer with ID 9 not found."))
                .when(customerService).deleteById(9L);

        mockMvc.perform(delete("/api/customers/9").with(csrfToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Entity not found: Customer with ID 9 not found."));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void deleteCustomer_withOpenInvoices_returns409() throws Exception {
        Mockito.doThrow(new EntityInUseException("Cannot delete customer 'Jane Doe': open invoices exist."))
                .when(customerService).deleteById(1L);

        mockMvc.perform(delete("/api/customers/1").with(csrfToken()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Cannot delete customer 'Jane Doe': open invoices exist."))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    private static @NonNull RequestPostProcessor csrfToken() {
        return Objects.requireNonNull(csrf());
    }
}
