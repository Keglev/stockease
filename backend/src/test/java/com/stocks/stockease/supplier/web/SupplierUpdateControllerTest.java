package com.stocks.stockease.supplier.web;

import java.time.LocalDateTime;
import java.util.Objects;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;

import jakarta.persistence.EntityNotFoundException;

/** Slice tests for PUT /api/suppliers/{id} (supplier update). */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(SupplierController.class)
@Import({TestConfig.class, SupplierMethodSecurityTestConfig.class})
class SupplierUpdateControllerTest {

    @MockitoBean
    private SupplierService supplierService;

    @Autowired
    private MockMvc mockMvc;

    private Supplier updated;

    @SuppressWarnings("unused")
    @BeforeEach
    void setUpMocks() {
        updated = new Supplier(1L, "Acme Two", null, null, "2 Side St", null, LocalDateTime.of(2026, 1, 2, 3, 4), null);
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(supplierService);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void updateSupplier_withValidData_returnsEnvelope() throws Exception {
        Mockito.when(supplierService.update(anyLong(), anyString(), Mockito.isNull(), Mockito.isNull(), anyString(), Mockito.isNull())).thenReturn(updated);

        mockMvc.perform(put("/api/suppliers/1")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Acme Two\", \"address\": \"2 Side St\"}")
                        .with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Supplier updated successfully"))
                .andExpect(jsonPath("$.data.name").value("Acme Two"))
                .andExpect(jsonPath("$.data.address").value("2 Side St"));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void updateSupplier_asUserRole_returns200() throws Exception {
        Mockito.when(supplierService.update(anyLong(), anyString(), Mockito.isNull(), Mockito.isNull(), anyString(), Mockito.isNull())).thenReturn(updated);

        mockMvc.perform(put("/api/suppliers/1")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Acme Two\", \"address\": \"2 Side St\"}")
                        .with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Acme Two"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void updateSupplier_withMissingId_returns404() throws Exception {
        Mockito.when(supplierService.update(anyLong(), anyString(), Mockito.isNull(), Mockito.isNull(), anyString(), Mockito.isNull()))
                .thenThrow(new EntityNotFoundException("Supplier with ID 9 not found."));

        mockMvc.perform(put("/api/suppliers/9")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Acme Two\", \"address\": \"2 Side St\"}")
                        .with(csrfToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Entity not found: Supplier with ID 9 not found."));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void updateSupplier_withBlankName_returns400() throws Exception {
        mockMvc.perform(put("/api/suppliers/1")
                        .contentType(applicationJson())
                        .content("{\"name\": \"\", \"address\": \"2 Side St\"}")
                        .with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.name").value("Supplier name is required."));

        Mockito.verify(supplierService, Mockito.never()).update(anyLong(), anyString(), any(), any(), anyString(), any());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void updateSupplier_withContactFields_passesThemThroughAndReturnsThem() throws Exception {
        Mockito.when(supplierService.update(1L, "Acme Two", "two@example.com", "555-9999", "2 Side St", "Shelbyville"))
                .thenReturn(new Supplier(1L, "Acme Two", "two@example.com", "555-9999", "2 Side St", "Shelbyville",
                        LocalDateTime.of(2026, 1, 2, 3, 4), null));

        mockMvc.perform(put("/api/suppliers/1")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Acme Two\", \"email\": \"two@example.com\", \"phone\": \"555-9999\","
                                + " \"address\": \"2 Side St\", \"city\": \"Shelbyville\"}")
                        .with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("two@example.com"))
                .andExpect(jsonPath("$.data.phone").value("555-9999"))
                .andExpect(jsonPath("$.data.city").value("Shelbyville"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void updateSupplier_omittingContactFields_passesNullsToTheService() throws Exception {
        // Wholesale replace: a body that leaves the optional fields out is asking for them to be
        // cleared, so the service must be called with nulls rather than with the stored values.
        Mockito.when(supplierService.update(anyLong(), anyString(), Mockito.isNull(), Mockito.isNull(), anyString(),
                Mockito.isNull())).thenReturn(updated);

        mockMvc.perform(put("/api/suppliers/1")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Acme Two\", \"address\": \"2 Side St\"}")
                        .with(csrfToken()))
                .andExpect(status().isOk());

        Mockito.verify(supplierService).update(1L, "Acme Two", null, null, "2 Side St", null);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void updateSupplier_withMalformedEmail_returns400() throws Exception {
        mockMvc.perform(put("/api/suppliers/1")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Acme Two\", \"address\": \"2 Side St\", \"email\": \"nope\"}")
                        .with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.email").value("Supplier email must be a valid email address."));

        Mockito.verify(supplierService, Mockito.never())
                .update(anyLong(), anyString(), any(), any(), anyString(), any());
    }

    @Test
    void updateSupplier_asAnonymous_returns401() throws Exception {
        mockMvc.perform(put("/api/suppliers/1")
                        .contentType(applicationJson())
                        .content("{\"name\": \"Acme Two\", \"address\": \"2 Side St\"}")
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
