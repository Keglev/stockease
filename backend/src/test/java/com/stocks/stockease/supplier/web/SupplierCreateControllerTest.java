package com.stocks.stockease.supplier.web;

import java.time.LocalDateTime;
import java.util.Objects;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.anyString;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;

/** Slice tests for POST /api/suppliers (supplier creation). */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(SupplierController.class)
@Import({TestConfig.class, SupplierMethodSecurityTestConfig.class})
class SupplierCreateControllerTest {

    @MockitoBean
    private SupplierService supplierService;

    @Autowired
    private MockMvc mockMvc;

    private Supplier supplier;

    @SuppressWarnings("unused")
    @BeforeEach
    void setUpMocks() {
        supplier = new Supplier(1L, "Acme", "1 Main St", LocalDateTime.of(2026, 1, 2, 3, 4), null);
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(supplierService);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createSupplier_withValidData_returns200() throws Exception {
        Mockito.when(supplierService.create(anyString(), anyString())).thenReturn(supplier);

        mockMvc.perform(post("/api/suppliers")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Acme\", \"address\": \"1 Main St\"}")
                        .with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("Acme"))
                .andExpect(jsonPath("$.address").value("1 Main St"));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void createSupplier_asUserRole_returns200() throws Exception {
        Mockito.when(supplierService.create(anyString(), anyString())).thenReturn(supplier);

        mockMvc.perform(post("/api/suppliers")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Acme\", \"address\": \"1 Main St\"}")
                        .with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Acme"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createSupplier_withBlankName_returns400() throws Exception {
        mockMvc.perform(post("/api/suppliers")
                        .contentType(applicationJson())
                        .content("{\"name\": \"  \", \"address\": \"1 Main St\"}")
                        .with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for request parameters."))
                .andExpect(jsonPath("$.data.name").value("Supplier name is required."));

        Mockito.verify(supplierService, Mockito.never()).create(anyString(), anyString());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createSupplier_withBlankAddress_returns400() throws Exception {
        mockMvc.perform(post("/api/suppliers")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Acme\", \"address\": \"\"}")
                        .with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.address").value("Supplier address is required."));
    }

    @Test
    void createSupplier_asAnonymous_returns401() throws Exception {
        mockMvc.perform(post("/api/suppliers")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Acme\", \"address\": \"1 Main St\"}")
                        .with(csrfToken()))
                .andExpect(status().isUnauthorized());
    }

    private static @NonNull MediaType applicationJson() {
        return Objects.requireNonNull(MediaType.APPLICATION_JSON);
    }

    private static @NonNull RequestPostProcessor csrfToken() {
        return Objects.requireNonNull(csrf());
    }
}
