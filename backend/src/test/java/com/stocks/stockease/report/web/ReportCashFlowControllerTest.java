package com.stocks.stockease.report.web;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
import com.stocks.stockease.report.CashFlowProductRow;
import com.stocks.stockease.report.CashFlowReport;
import com.stocks.stockease.report.ReportingService;

/** Slice tests for GET /api/reports/cash-flow. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ReportController.class)
@Import({TestConfig.class, ReportMethodSecurityTestConfig.class})
class ReportCashFlowControllerTest {

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

    private static CashFlowReport report() {
        CashFlowProductRow row = new CashFlowProductRow(3L, "Widget", "SKU-3", false,
                new BigDecimal("80.00"), new BigDecimal("30.00"), new BigDecimal("50.00"));
        return new CashFlowReport(new BigDecimal("80.00"), new BigDecimal("30.00"), new BigDecimal("50.00"),
                List.of(row));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void cashFlow_withRows_returnsTotalsAndBreakdown() throws Exception {
        Mockito.when(reportingService.cashFlow(null, null)).thenReturn(report());

        mockMvc.perform(get("/api/reports/cash-flow"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inflow").value(80.00))
                .andExpect(jsonPath("$.outflow").value(30.00))
                .andExpect(jsonPath("$.net").value(50.00))
                .andExpect(jsonPath("$.products[0].productId").value(3))
                .andExpect(jsonPath("$.products[0].net").value(50.00));

        Mockito.verify(reportingService).cashFlow(null, null);
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void cashFlow_withPeriod_passesBothBoundsThrough() throws Exception {
        LocalDate from = LocalDate.of(2026, 1, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        Mockito.when(reportingService.cashFlow(from, to)).thenReturn(report());

        mockMvc.perform(get("/api/reports/cash-flow").param("from", "2026-01-01").param("to", "2026-03-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.net").value(50.00));

        Mockito.verify(reportingService).cashFlow(from, to);
    }

    @ParameterizedTest
    @CsvSource({"2026-03-31,2026-01-01", "2026-01-02,2026-01-01"})
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void cashFlow_withStartAfterEnd_returns400(String from, String to) throws Exception {
        mockMvc.perform(get("/api/reports/cash-flow").param("from", from).param("to", to))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("The start of the period must not be after its end."));

        Mockito.verify(reportingService, Mockito.never()).cashFlow(Mockito.any(), Mockito.any());
    }

    @Test
    void cashFlow_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/reports/cash-flow"))
                .andExpect(status().isUnauthorized());

        Mockito.verify(reportingService, Mockito.never()).cashFlow(Mockito.any(), Mockito.any());
    }
}
