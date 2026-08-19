package com.stocks.stockease.invoice.web;

import com.stocks.stockease.shared.ApiErrorCodes;
import java.util.Map;
import static com.stocks.stockease.invoice.web.InvoiceTestFixtures.csrfToken;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.UserService;
import com.stocks.stockease.shared.InsufficientStockException;
import com.stocks.stockease.shared.InvoiceStateException;

import jakarta.persistence.EntityNotFoundException;

/** Slice tests for PATCH /api/invoices/{id}/close, the admin-only stock-booking act. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(InvoiceController.class)
@Import({TestConfig.class, InvoiceMethodSecurityTestConfig.class})
class InvoiceCloseControllerTest {

    @MockitoBean
    private InvoiceService invoiceService;

    @MockitoBean
    private UserService userService;

    @Autowired
    private MockMvc mockMvc;

    @SuppressWarnings("unused") // invoked by JUnit via reflection, not by direct call
    @BeforeEach
    void setUpMocks() {
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(invoiceService, userService);
        Mockito.when(userService.findByUsername("admin"))
                .thenReturn(Optional.of(new User("admin", "hash", "ROLE_ADMIN")));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void closeInvoice_asAdmin_closesWithResolvedPrincipal() throws Exception {
        Mockito.when(invoiceService.close(eq(1L), any(User.class)))
                .thenReturn(InvoiceTestFixtures.purchaseInvoice(InvoiceStatus.CLOSED));

        mockMvc.perform(patch("/api/invoices/1/close").with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Invoice closed successfully"))
                .andExpect(jsonPath("$.data.status").value("CLOSED"));

        Mockito.verify(invoiceService).close(eq(1L), Mockito.argThat(user -> "admin".equals(user.getUsername())));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void closeInvoice_whenNotOpen_returns409() throws Exception {
        Mockito.when(invoiceService.close(eq(1L), any(User.class)))
                .thenThrow(new InvoiceStateException("Only open invoices can be closed.",
                        ApiErrorCodes.INVOICE_NOT_OPEN_FOR_CLOSE, null));

        mockMvc.perform(patch("/api/invoices/1/close").with(csrfToken()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Only open invoices can be closed."));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void closeInvoice_whenSaleExceedsStock_returns409() throws Exception {
        Mockito.when(invoiceService.close(eq(1L), any(User.class)))
                .thenThrow(new InsufficientStockException(
                        "Adjustment of -5 would result in negative stock for product 3 (current: 3)."));

        mockMvc.perform(patch("/api/invoices/1/close").with(csrfToken()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message")
                        .value("Adjustment of -5 would result in negative stock for product 3 (current: 3)."));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void closeInvoice_withUnknownId_returns404() throws Exception {
        Mockito.when(invoiceService.close(eq(9L), any(User.class)))
                .thenThrow(new EntityNotFoundException("Invoice with ID 9 not found."));

        mockMvc.perform(patch("/api/invoices/9/close").with(csrfToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Entity not found: Invoice with ID 9 not found."));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void closeInvoice_asUserRole_returns403() throws Exception {
        mockMvc.perform(patch("/api/invoices/1/close").with(csrfToken()))
                .andExpect(status().isForbidden());

        Mockito.verify(invoiceService, Mockito.never()).close(anyLong(), any(User.class));
    }

    @Test
    void closeInvoice_asAnonymous_returns401() throws Exception {
        mockMvc.perform(patch("/api/invoices/1/close").with(csrfToken()))
                .andExpect(status().isUnauthorized());

        Mockito.verify(invoiceService, Mockito.never()).close(anyLong(), any(User.class));
    }
}
