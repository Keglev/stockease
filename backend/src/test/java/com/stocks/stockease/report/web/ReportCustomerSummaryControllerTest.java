package com.stocks.stockease.report.web;

import java.math.BigDecimal;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.anyLong;
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
import com.stocks.stockease.report.CustomerSummary;
import com.stocks.stockease.report.ReportingService;

/** Slice tests for GET /api/reports/customers/{id}/summary. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ReportController.class)
@Import({TestConfig.class, ReportMethodSecurityTestConfig.class})
class ReportCustomerSummaryControllerTest {

    @MockitoBean
    private ReportingService reportingService;

    @Autowired
    private MockMvc mockMvc;

    @SuppressWarnings("unused")
    @BeforeEach
    void setUpMocks() {
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(reportingService);
    }

    private static CustomerSummary summary() {
        return new CustomerSummary(9L, "Jane Doe", false, 1L, 5L, new BigDecimal("80.00"), 1L,
                new BigDecimal("10.00"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void customerSummary_withExistingCustomer_returnsEnvelope() throws Exception {
        Mockito.when(reportingService.customerSummary(9L)).thenReturn(Optional.of(summary()));

        mockMvc.perform(get("/api/reports/customers/9/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Customer summary fetched successfully"))
                .andExpect(jsonPath("$.data.customerId").value(9))
                .andExpect(jsonPath("$.data.name").value("Jane Doe"))
                .andExpect(jsonPath("$.data.deleted").value(false))
                .andExpect(jsonPath("$.data.saleInvoiceCount").value(1))
                .andExpect(jsonPath("$.data.boughtUnits").value(5))
                .andExpect(jsonPath("$.data.boughtValue").value(80.00))
                .andExpect(jsonPath("$.data.returnedValue").value(10.00));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void customerSummary_asUserRole_returns200() throws Exception {
        Mockito.when(reportingService.customerSummary(9L)).thenReturn(Optional.of(summary()));

        mockMvc.perform(get("/api/reports/customers/9/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.customerId").value(9));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void customerSummary_withUnknownId_returns404() throws Exception {
        Mockito.when(reportingService.customerSummary(999L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/reports/customers/999/summary"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Entity not found: Customer with ID 999 not found."));
    }

    @Test
    void customerSummary_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/reports/customers/9/summary"))
                .andExpect(status().isUnauthorized());

        Mockito.verify(reportingService, Mockito.never()).customerSummary(anyLong());
    }
}
