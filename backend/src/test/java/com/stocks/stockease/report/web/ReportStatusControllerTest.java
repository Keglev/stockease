package com.stocks.stockease.report.web;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.mockito.ArgumentMatchers.anyInt;
import org.mockito.ArgumentCaptor;
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
import com.stocks.stockease.report.DueDateBucket;
import com.stocks.stockease.report.InvoiceDueSummary;
import com.stocks.stockease.report.LossReport;
import com.stocks.stockease.report.ReportingService;
import com.stocks.stockease.report.StockStatusReport;

/** Slice tests for the stock, loss and due-date endpoints under /api/reports. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ReportController.class)
@Import({TestConfig.class, ReportMethodSecurityTestConfig.class})
class ReportStatusControllerTest {

    private static final LocalDate DUE_DATE = LocalDate.of(2026, 3, 1);

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

    private static InvoiceDueSummary dueSummary(Long daysOverdue) {
        return new InvoiceDueSummary(1L, "INV-1", "SALE", "Jane Doe", DUE_DATE, new BigDecimal("30.00"),
                daysOverdue);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void stockStatus_withRows_returnsRecordsDirectly() throws Exception {
        Mockito.when(reportingService.stockStatus()).thenReturn(List.of(new StockStatusReport(
                3L, "Widget", "SKU-3", 4, new BigDecimal("60.00"), 6, new BigDecimal("30.00"))));

        mockMvc.perform(get("/api/reports/stock-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].productId").value(3))
                .andExpect(jsonPath("$[0].soldUnits").value(4))
                .andExpect(jsonPath("$[0].inStockValue").value(30.00));

        Mockito.verify(reportingService).stockStatus();
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void lossReport_withRows_returnsRecordsDirectly() throws Exception {
        Mockito.when(reportingService.lossReport()).thenReturn(List.of(new LossReport(
                3L, "Widget", "SKU-3", false, 2, 1, new BigDecimal("15.00"))));

        mockMvc.perform(get("/api/reports/losses"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].lostUnits").value(2))
                .andExpect(jsonPath("$[0].destroyedUnits").value(1))
                .andExpect(jsonPath("$[0].lossValue").value(15.00));

        Mockito.verify(reportingService).lossReport();
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void dueDateBuckets_withRows_returnsRecordsDirectly() throws Exception {
        Mockito.when(reportingService.dueDateBuckets())
                .thenReturn(List.of(new DueDateBucket(DUE_DATE, "SALE", 2L, new BigDecimal("60.00"))));

        mockMvc.perform(get("/api/reports/due-dates"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].dueDate").value("2026-03-01"))
                .andExpect(jsonPath("$[0].invoiceCount").value(2))
                .andExpect(jsonPath("$[0].totalValue").value(60.00));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void dueSoon_withoutDaysParam_appliesSevenDayDefault() throws Exception {
        Mockito.when(reportingService.dueSoon(anyInt())).thenReturn(List.of(dueSummary(null)));

        mockMvc.perform(get("/api/reports/due-soon"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].invoiceId").value(1))
                .andExpect(jsonPath("$[0].counterparty").value("Jane Doe"));

        // captured rather than assumed: the default lives in the annotation and would silently drift
        ArgumentCaptor<Integer> days = ArgumentCaptor.forClass(Integer.class);
        Mockito.verify(reportingService).dueSoon(days.capture());
        assertThat(days.getValue()).isEqualTo(7);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void dueSoon_withExplicitDays_passesValueThrough() throws Exception {
        Mockito.when(reportingService.dueSoon(30)).thenReturn(List.of(dueSummary(null)));

        mockMvc.perform(get("/api/reports/due-soon").param("days", "30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].invoiceId").value(1));

        Mockito.verify(reportingService).dueSoon(30);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1"})
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void dueSoon_withNonPositiveDays_returns400(String days) throws Exception {
        mockMvc.perform(get("/api/reports/due-soon").param("days", days))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Days must be positive."));

        Mockito.verify(reportingService, Mockito.never()).dueSoon(anyInt());
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void overdue_withRows_includesDaysOverdue() throws Exception {
        Mockito.when(reportingService.overdue()).thenReturn(List.of(dueSummary(5L)));

        mockMvc.perform(get("/api/reports/overdue"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].daysOverdue").value(5))
                .andExpect(jsonPath("$[0].outstandingValue").value(30.00));

        Mockito.verify(reportingService).overdue();
    }

    @Test
    void overdue_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/reports/overdue"))
                .andExpect(status().isUnauthorized());

        Mockito.verify(reportingService, Mockito.never()).overdue();
    }
}
