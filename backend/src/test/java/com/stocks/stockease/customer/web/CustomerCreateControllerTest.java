package com.stocks.stockease.customer.web;

import java.time.LocalDateTime;
import java.util.Objects;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.customer.Customer;
import com.stocks.stockease.customer.CustomerService;

/** Slice tests for POST /api/customers (customer creation). */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(CustomerController.class)
@Import({TestConfig.class, CustomerMethodSecurityTestConfig.class})
class CustomerCreateControllerTest {

    private static final String VALID_BODY =
            "{\"name\": \"Jane Doe\", \"email\": \"jane@example.com\", \"phone\": \"555-1234\","
            + " \"address\": \"1 Main St\", \"city\": \"Springfield\"}";

    @MockitoBean
    private CustomerService customerService;

    @Autowired
    private MockMvc mockMvc;

    private Customer customer;

    @SuppressWarnings("unused")
    @BeforeEach
    void setUpMocks() {
        customer = new Customer(1L, "Jane Doe", "jane@example.com", "555-1234", "1 Main St", "Springfield",
                LocalDateTime.of(2026, 1, 2, 3, 4), null);
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(customerService);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createCustomer_withValidData_returns200() throws Exception {
        Mockito.when(customerService.create(anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(customer);

        mockMvc.perform(post("/api/customers")
                        .contentType(applicationJson()).content(VALID_BODY).with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("Jane Doe"))
                .andExpect(jsonPath("$.email").value("jane@example.com"));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void createCustomer_asUserRole_returns200() throws Exception {
        Mockito.when(customerService.create(anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(customer);

        mockMvc.perform(post("/api/customers")
                        .contentType(applicationJson()).content(VALID_BODY).with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Jane Doe"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createCustomer_withoutOptionalFields_returns200() throws Exception {
        Mockito.when(customerService.create(anyString(), Mockito.isNull(), Mockito.isNull(), Mockito.isNull(),
                Mockito.isNull())).thenReturn(customer);

        mockMvc.perform(post("/api/customers")
                        .contentType(applicationJson()).content("{\"name\": \"Jane Doe\"}").with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Jane Doe"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createCustomer_withBlankName_returns400() throws Exception {
        mockMvc.perform(post("/api/customers")
                        .contentType(applicationJson()).content("{\"name\": \"  \"}").with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for request parameters."))
                .andExpect(jsonPath("$.data.name").value("Customer name is required."));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createCustomer_withMalformedEmail_returns400() throws Exception {
        mockMvc.perform(post("/api/customers")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Jane Doe\", \"email\": \"not-an-email\"}").with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.email").value("Customer email must be a valid email address."));
    }

    @Test
    void createCustomer_asAnonymous_returns401() throws Exception {
        mockMvc.perform(post("/api/customers")
                        .contentType(applicationJson()).content(VALID_BODY).with(csrfToken()))
                .andExpect(status().isUnauthorized());
    }

    private static @NonNull MediaType applicationJson() {
        return Objects.requireNonNull(MediaType.APPLICATION_JSON);
    }

    private static @NonNull RequestPostProcessor csrfToken() {
        return Objects.requireNonNull(csrf());
    }
}
