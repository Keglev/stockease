package com.stocks.stockease.customer.web;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.customer.Customer;
import com.stocks.stockease.customer.CustomerService;

/** Slice tests for GET /api/customers and GET /api/customers/{id}. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(CustomerController.class)
@Import({TestConfig.class, CustomerMethodSecurityTestConfig.class})
class CustomerFetchControllerTest {

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
    void getAllCustomers_asAdmin_returnsMappedList() throws Exception {
        Mockito.when(customerService.findAll()).thenReturn(List.of(customer));

        mockMvc.perform(get("/api/customers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].name").value("Jane Doe"))
                .andExpect(jsonPath("$[0].email").value("jane@example.com"))
                .andExpect(jsonPath("$[0].city").value("Springfield"));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void getAllCustomers_asUserRole_returns200() throws Exception {
        Mockito.when(customerService.findAll()).thenReturn(List.of(customer));

        mockMvc.perform(get("/api/customers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Jane Doe"));
    }

    @Test
    void getAllCustomers_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/customers"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void getCustomerById_withExistingId_returnsEnvelope() throws Exception {
        Mockito.when(customerService.findById(1L)).thenReturn(Optional.of(customer));

        mockMvc.perform(get("/api/customers/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Customer fetched successfully"))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.phone").value("555-1234"));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void getCustomerById_withMissingId_returns404() throws Exception {
        Mockito.when(customerService.findById(9L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/customers/9"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Entity not found: Customer with ID 9 not found."));
    }

    @Test
    void getCustomerById_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/customers/1"))
                .andExpect(status().isUnauthorized());
    }
}
