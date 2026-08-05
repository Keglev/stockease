package com.stocks.stockease.supplier.web;

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
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;

/** Slice tests for GET /api/suppliers and GET /api/suppliers/{id}. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(SupplierController.class)
@Import({TestConfig.class, SupplierMethodSecurityTestConfig.class})
class SupplierFetchControllerTest {

    @MockitoBean
    private SupplierService supplierService;

    @Autowired
    private MockMvc mockMvc;

    private Supplier supplier;

    @SuppressWarnings("unused")
    @BeforeEach
    void setUpMocks() {
        supplier = new Supplier(1L, "Acme", null, null, "1 Main St", null, LocalDateTime.of(2026, 1, 2, 3, 4), null);
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(supplierService);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getAllSuppliers_asAdmin_returnsMappedList() throws Exception {
        Mockito.when(supplierService.findAll()).thenReturn(List.of(supplier));

        mockMvc.perform(get("/api/suppliers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].name").value("Acme"))
                .andExpect(jsonPath("$[0].address").value("1 Main St"))
                .andExpect(jsonPath("$[0].createdAt").exists());
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void getAllSuppliers_asUserRole_returns200() throws Exception {
        Mockito.when(supplierService.findAll()).thenReturn(List.of(supplier));

        mockMvc.perform(get("/api/suppliers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Acme"));
    }

    @Test
    void getAllSuppliers_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/suppliers"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void getSupplierById_withExistingId_returnsEnvelope() throws Exception {
        Mockito.when(supplierService.findById(1L)).thenReturn(Optional.of(supplier));

        mockMvc.perform(get("/api/suppliers/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Supplier fetched successfully"))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.name").value("Acme"));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void getSupplierById_withMissingId_returns404() throws Exception {
        Mockito.when(supplierService.findById(9L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/suppliers/9"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Entity not found: Supplier with ID 9 not found."));
    }

    @Test
    void getSupplierById_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/suppliers/1"))
                .andExpect(status().isUnauthorized());
    }
}
