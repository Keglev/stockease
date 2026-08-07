package com.stocks.stockease.supplier.web;

import java.time.LocalDateTime;
import java.util.List;

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
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;

/** Slice tests for GET /api/suppliers/search, the supplier typeahead. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(SupplierController.class)
@Import({TestConfig.class, SupplierMethodSecurityTestConfig.class})
class SupplierSearchControllerTest {

    @MockitoBean
    private SupplierService supplierService;

    @Autowired
    private MockMvc mockMvc;

    private Supplier supplier;

    @SuppressWarnings("unused") // invoked by JUnit via reflection, not by direct call
    @BeforeEach
    void setUpMocks() {
        supplier = new Supplier(1L, "Acme", null, null, "1 Main St", null, LocalDateTime.of(2026, 1, 2, 3, 4), null);
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(supplierService);
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void searchSuppliersByName_withMatches_returnsMappedList() throws Exception {
        Mockito.when(supplierService.searchByName("acm")).thenReturn(List.of(supplier));

        mockMvc.perform(get("/api/suppliers/search").param("name", "acm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].name").value("Acme"));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void searchSuppliersByName_withNoMatches_returns200WithEmptyArray() throws Exception {
        Mockito.when(supplierService.searchByName("zzz")).thenReturn(List.of());

        // 200 with [] rather than a 204 carrying a body. GET /api/products/search answered the latter
        // until 2.16.0 corrected it; ADR 028 records why this endpoint did not copy that shape.
        mockMvc.perform(get("/api/suppliers/search").param("name", "zzz"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void searchSuppliersByName_withoutNameParam_returns400() throws Exception {
        // proves the missing-parameter 400 is the shared handler's behaviour rather than something
        // the product search does for itself: this endpoint gained it without being touched
        mockMvc.perform(get("/api/suppliers/search"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data.name").value("required parameter is missing"));

        Mockito.verify(supplierService, Mockito.never()).searchByName(Mockito.any());
    }

    @Test
    void searchSuppliersByName_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/suppliers/search").param("name", "acm"))
                .andExpect(status().isUnauthorized());

        Mockito.verify(supplierService, Mockito.never()).searchByName(Mockito.any());
    }
}
