package com.stocks.stockease.report.web;

import java.math.BigDecimal;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.report.ReportingService;
import com.stocks.stockease.report.SupplierProduct;

/** Slice tests for GET /api/reports/suppliers/{id}/products/search, the scoped product typeahead. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ReportController.class)
@Import({TestConfig.class, ReportMethodSecurityTestConfig.class})
class ReportSupplierProductsControllerTest {

    @MockitoBean
    private ReportingService reportingService;

    @Autowired
    private MockMvc mockMvc;

    @SuppressWarnings("unused") // invoked by JUnit via reflection, not by direct call
    @BeforeEach
    void setUpMocks() {
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(reportingService);
    }

    private static SupplierProduct product() {
        return new SupplierProduct(3L, "Widget", "SKU-3", 50, new BigDecimal("9.99"), new BigDecimal("499.50"),
                LocalDateTime.of(2026, 1, 2, 3, 4));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void supplierProducts_withMatches_returnsRecordsDirectly() throws Exception {
        Mockito.when(reportingService.supplierProducts(7L, "wid")).thenReturn(Optional.of(List.of(product())));

        mockMvc.perform(get("/api/reports/suppliers/7/products/search").param("name", "wid"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(3))
                .andExpect(jsonPath("$[0].name").value("Widget"))
                .andExpect(jsonPath("$[0].totalValue").value(499.50));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void supplierProducts_supplierBoughtNothingMatching_returns200WithEmptyArray() throws Exception {
        Mockito.when(reportingService.supplierProducts(7L, "zzz")).thenReturn(Optional.of(List.of()));

        // a real supplier with no match is an empty array, not a 404 and not a 204-with-body
        mockMvc.perform(get("/api/reports/suppliers/7/products/search").param("name", "zzz"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void supplierProducts_unknownSupplier_returns404() throws Exception {
        Mockito.when(reportingService.supplierProducts(999L, "wid")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/reports/suppliers/999/products/search").param("name", "wid"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Entity not found: Supplier with ID 999 not found."));
    }

    @Test
    void supplierProducts_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/reports/suppliers/7/products/search").param("name", "wid"))
                .andExpect(status().isUnauthorized());

        Mockito.verify(reportingService, Mockito.never()).supplierProducts(Mockito.anyLong(), Mockito.any());
    }
}
