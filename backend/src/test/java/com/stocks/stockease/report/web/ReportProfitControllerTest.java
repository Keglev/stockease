package com.stocks.stockease.report.web;

import java.math.BigDecimal;
import java.time.LocalDate;
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

import com.stocks.stockease.shared.ApiErrorCodes;
import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.report.ProductProfitReport;
import com.stocks.stockease.report.CashFlowReportingService;
import com.stocks.stockease.report.CounterpartyReportingService;
import com.stocks.stockease.report.ProfitReportingService;
import com.stocks.stockease.report.StockReportingService;
import com.stocks.stockease.report.SupplierProfitReport;

/** Slice tests for the profit endpoints under /api/reports/profit. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ReportController.class)
@Import({TestConfig.class, ReportMethodSecurityTestConfig.class})
class ReportProfitControllerTest {

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

    private static ProductProfitReport productProfit() {
        return new ProductProfitReport(3L, "Widget", "SKU-3", false, new BigDecimal("100.00"),
                new BigDecimal("40.00"), new BigDecimal("60.00"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void profitPerProduct_withRows_returnsRecordsDirectly() throws Exception {
        Mockito.when(profitReportingService.profitPerProduct(null, null)).thenReturn(List.of(productProfit()));

        mockMvc.perform(get("/api/reports/profit/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].productId").value(3))
                .andExpect(jsonPath("$[0].name").value("Widget"))
                .andExpect(jsonPath("$[0].deleted").value(false))
                .andExpect(jsonPath("$[0].grossProfit").value(60.00));

        Mockito.verify(profitReportingService).profitPerProduct(null, null);
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void profitPerProduct_asUserRole_returns200() throws Exception {
        Mockito.when(profitReportingService.profitPerProduct(null, null)).thenReturn(List.of(productProfit()));

        mockMvc.perform(get("/api/reports/profit/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].productId").value(3));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void profitPerProduct_withPeriod_passesBothBoundsThrough() throws Exception {
        LocalDate from = LocalDate.of(2026, 1, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        Mockito.when(profitReportingService.profitPerProduct(from, to)).thenReturn(List.of(productProfit()));

        mockMvc.perform(get("/api/reports/profit/products")
                        .param("from", "2026-01-01").param("to", "2026-03-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].productId").value(3));

        Mockito.verify(profitReportingService).profitPerProduct(from, to);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void profitPerProduct_withStartAfterEnd_returns400() throws Exception {
        mockMvc.perform(get("/api/reports/profit/products")
                        .param("from", "2026-03-31").param("to", "2026-01-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("The start of the period must not be after its end."));

        Mockito.verify(profitReportingService, Mockito.never()).profitPerProduct(Mockito.any(), Mockito.any());
    }

    @Test
    void profitPerProduct_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/reports/profit/products"))
                .andExpect(status().isUnauthorized());

        Mockito.verify(profitReportingService, Mockito.never()).profitPerProduct(null, null);
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void profitForProduct_withExistingProduct_returnsEnvelope() throws Exception {
        Mockito.when(profitReportingService.profitForProduct(3L, null, null)).thenReturn(Optional.of(productProfit()));

        mockMvc.perform(get("/api/reports/profit/products/3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Product profit fetched successfully"))
                .andExpect(jsonPath("$.data.productId").value(3))
                .andExpect(jsonPath("$.data.revenue").value(100.00));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void profitForProduct_withUnknownProduct_returns404() throws Exception {
        Mockito.when(profitReportingService.profitForProduct(9L, null, null)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/reports/profit/products/9"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message")
                        .value("Entity not found: No profit report for product with ID 9."))
                // The controller is this code's only throw site, so the slice is where the
                // situation is pinned rather than a service test.
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.PROFIT_REPORT_NOT_FOUND))
                .andExpect(jsonPath("$.params.id").value("9"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void profitPerSupplier_withRows_returnsRecordsDirectly() throws Exception {
        Mockito.when(profitReportingService.profitPerSupplier(null, null)).thenReturn(List.of(new SupplierProfitReport(
                7L, "Acme", new BigDecimal("100.00"), new BigDecimal("40.00"), new BigDecimal("60.00"))));

        mockMvc.perform(get("/api/reports/profit/suppliers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].supplierId").value(7))
                .andExpect(jsonPath("$[0].name").value("Acme"))
                .andExpect(jsonPath("$[0].grossProfit").value(60.00));

        Mockito.verify(profitReportingService).profitPerSupplier(null, null);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void profitPerSupplier_withNoRows_returnsEmptyList() throws Exception {
        Mockito.when(profitReportingService.profitPerSupplier(null, null)).thenReturn(List.of());

        mockMvc.perform(get("/api/reports/profit/suppliers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void profitPerSupplier_withPeriod_passesBothBoundsThrough() throws Exception {
        LocalDate from = LocalDate.of(2026, 1, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        Mockito.when(profitReportingService.profitPerSupplier(from, to)).thenReturn(List.of(new SupplierProfitReport(
                7L, "Acme", new BigDecimal("100.00"), new BigDecimal("40.00"), new BigDecimal("60.00"))));

        mockMvc.perform(get("/api/reports/profit/suppliers")
                        .param("from", "2026-01-01").param("to", "2026-03-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].supplierId").value(7));

        Mockito.verify(profitReportingService).profitPerSupplier(from, to);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void profitPerSupplier_withStartAfterEnd_returns400() throws Exception {
        mockMvc.perform(get("/api/reports/profit/suppliers")
                        .param("from", "2026-03-31").param("to", "2026-01-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("The start of the period must not be after its end."));

        Mockito.verify(profitReportingService, Mockito.never()).profitPerSupplier(Mockito.any(), Mockito.any());
    }
}
