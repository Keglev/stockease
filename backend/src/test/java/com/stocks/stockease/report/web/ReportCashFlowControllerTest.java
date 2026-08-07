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
import com.stocks.stockease.report.CashFlowTimelineBucket;
import com.stocks.stockease.report.CashFlowReportingService;
import com.stocks.stockease.report.CounterpartyReportingService;
import com.stocks.stockease.report.ProfitReportingService;
import com.stocks.stockease.report.StockReportingService;

/** Slice tests for GET /api/reports/cash-flow. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ReportController.class)
@Import({TestConfig.class, ReportMethodSecurityTestConfig.class})
class ReportCashFlowControllerTest {

    // Constructor injection needs every collaborator on the context, so all four are declared
    // here even where this slice stubs only one of them.
    @MockitoBean
    private ProfitReportingService profitReportingService;

    @MockitoBean
    private CashFlowReportingService cashFlowReportingService;

    @MockitoBean
    private StockReportingService stockReportingService;

    @MockitoBean
    private CounterpartyReportingService counterpartyReportingService;

    @Autowired
    private MockMvc mockMvc;

    @SuppressWarnings("unused") // invoked by JUnit via reflection, not by direct call
    @BeforeEach
    void setUpMocks() {
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(profitReportingService, cashFlowReportingService, stockReportingService,
                counterpartyReportingService);
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
        Mockito.when(cashFlowReportingService.cashFlow(null, null)).thenReturn(report());

        mockMvc.perform(get("/api/reports/cash-flow"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inflow").value(80.00))
                .andExpect(jsonPath("$.outflow").value(30.00))
                .andExpect(jsonPath("$.net").value(50.00))
                .andExpect(jsonPath("$.products[0].productId").value(3))
                .andExpect(jsonPath("$.products[0].net").value(50.00));

        Mockito.verify(cashFlowReportingService).cashFlow(null, null);
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void cashFlow_withPeriod_passesBothBoundsThrough() throws Exception {
        LocalDate from = LocalDate.of(2026, 1, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        Mockito.when(cashFlowReportingService.cashFlow(from, to)).thenReturn(report());

        mockMvc.perform(get("/api/reports/cash-flow").param("from", "2026-01-01").param("to", "2026-03-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.net").value(50.00));

        Mockito.verify(cashFlowReportingService).cashFlow(from, to);
    }

    @ParameterizedTest
    @CsvSource({"2026-03-31,2026-01-01", "2026-01-02,2026-01-01"})
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void cashFlow_withStartAfterEnd_returns400(String from, String to) throws Exception {
        mockMvc.perform(get("/api/reports/cash-flow").param("from", from).param("to", to))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("The start of the period must not be after its end."));

        Mockito.verify(cashFlowReportingService, Mockito.never()).cashFlow(Mockito.any(), Mockito.any());
    }

    @Test
    void cashFlow_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/reports/cash-flow"))
                .andExpect(status().isUnauthorized());

        Mockito.verify(cashFlowReportingService, Mockito.never()).cashFlow(Mockito.any(), Mockito.any());
    }

    private static List<CashFlowTimelineBucket> timeline() {
        return List.of(new CashFlowTimelineBucket("2026-02", new BigDecimal("0.00"), new BigDecimal("45.00"),
                new BigDecimal("-45.00")));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void cashFlowTimeline_withBuckets_returnsRecordsDirectly() throws Exception {
        Mockito.when(cashFlowReportingService.cashFlowTimeline(null, null, null)).thenReturn(timeline());

        mockMvc.perform(get("/api/reports/cash-flow/timeline"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].month").value("2026-02"))
                .andExpect(jsonPath("$[0].outflow").value(45.00))
                .andExpect(jsonPath("$[0].net").value(-45.00));

        Mockito.verify(cashFlowReportingService).cashFlowTimeline(null, null, null);
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void cashFlowTimeline_withPeriod_passesBothBoundsThrough() throws Exception {
        LocalDate from = LocalDate.of(2026, 1, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        Mockito.when(cashFlowReportingService.cashFlowTimeline(from, to, null)).thenReturn(timeline());

        mockMvc.perform(get("/api/reports/cash-flow/timeline")
                        .param("from", "2026-01-01").param("to", "2026-03-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].month").value("2026-02"));

        Mockito.verify(cashFlowReportingService).cashFlowTimeline(from, to, null);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void cashFlowTimeline_withStartAfterEnd_returns400() throws Exception {
        mockMvc.perform(get("/api/reports/cash-flow/timeline")
                        .param("from", "2026-03-31").param("to", "2026-01-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("The start of the period must not be after its end."));

        Mockito.verify(cashFlowReportingService, Mockito.never()).cashFlowTimeline(Mockito.any(), Mockito.any(), Mockito.any());
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void cashFlowTimeline_withProductId_scopesTheSeries() throws Exception {
        Mockito.when(stockReportingService.productExists(7L)).thenReturn(true);
        Mockito.when(cashFlowReportingService.cashFlowTimeline(null, null, 7L)).thenReturn(timeline());

        mockMvc.perform(get("/api/reports/cash-flow/timeline").param("productId", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].month").value("2026-02"));

        Mockito.verify(cashFlowReportingService).cashFlowTimeline(null, null, 7L);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void cashFlowTimeline_withUnknownProductId_returns404() throws Exception {
        Mockito.when(stockReportingService.productExists(999L)).thenReturn(false);

        mockMvc.perform(get("/api/reports/cash-flow/timeline").param("productId", "999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Entity not found: Product with ID 999 not found."));

        // an unknown product is the caller's mistake, not an empty series
        Mockito.verify(cashFlowReportingService, Mockito.never()).cashFlowTimeline(Mockito.any(), Mockito.any(), Mockito.any());
    }

    @Test
    void cashFlowTimeline_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/reports/cash-flow/timeline"))
                .andExpect(status().isUnauthorized());

        Mockito.verify(cashFlowReportingService, Mockito.never()).cashFlowTimeline(Mockito.any(), Mockito.any(), Mockito.any());
    }
}
