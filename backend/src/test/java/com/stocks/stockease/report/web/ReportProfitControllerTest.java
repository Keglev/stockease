package com.stocks.stockease.report.web;

import java.math.BigDecimal;
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
import com.stocks.stockease.report.ProductProfitReport;
import com.stocks.stockease.report.ReportingService;
import com.stocks.stockease.report.SupplierProfitReport;

/** Slice tests for the profit endpoints under /api/reports/profit. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ReportController.class)
@Import({TestConfig.class, ReportMethodSecurityTestConfig.class})
class ReportProfitControllerTest {

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

    private static ProductProfitReport productProfit() {
        return new ProductProfitReport(3L, "Widget", "SKU-3", false, new BigDecimal("100.00"),
                new BigDecimal("40.00"), new BigDecimal("60.00"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void profitPerProduct_withRows_returnsRecordsDirectly() throws Exception {
        Mockito.when(reportingService.profitPerProduct()).thenReturn(List.of(productProfit()));

        mockMvc.perform(get("/api/reports/profit/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].productId").value(3))
                .andExpect(jsonPath("$[0].name").value("Widget"))
                .andExpect(jsonPath("$[0].deleted").value(false))
                .andExpect(jsonPath("$[0].grossProfit").value(60.00));

        Mockito.verify(reportingService).profitPerProduct();
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void profitPerProduct_asUserRole_returns200() throws Exception {
        Mockito.when(reportingService.profitPerProduct()).thenReturn(List.of(productProfit()));

        mockMvc.perform(get("/api/reports/profit/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].productId").value(3));
    }

    @Test
    void profitPerProduct_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/reports/profit/products"))
                .andExpect(status().isUnauthorized());

        Mockito.verify(reportingService, Mockito.never()).profitPerProduct();
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void profitForProduct_withExistingProduct_returnsEnvelope() throws Exception {
        Mockito.when(reportingService.profitForProduct(3L)).thenReturn(Optional.of(productProfit()));

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
        Mockito.when(reportingService.profitForProduct(9L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/reports/profit/products/9"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message")
                        .value("Entity not found: No profit report for product with ID 9."));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void profitPerSupplier_withRows_returnsRecordsDirectly() throws Exception {
        Mockito.when(reportingService.profitPerSupplier()).thenReturn(List.of(new SupplierProfitReport(
                7L, "Acme", new BigDecimal("100.00"), new BigDecimal("40.00"), new BigDecimal("60.00"))));

        mockMvc.perform(get("/api/reports/profit/suppliers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].supplierId").value(7))
                .andExpect(jsonPath("$[0].name").value("Acme"))
                .andExpect(jsonPath("$[0].grossProfit").value(60.00));

        Mockito.verify(reportingService).profitPerSupplier();
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void profitPerSupplier_withNoRows_returnsEmptyList() throws Exception {
        Mockito.when(reportingService.profitPerSupplier()).thenReturn(List.of());

        mockMvc.perform(get("/api/reports/profit/suppliers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }
}
