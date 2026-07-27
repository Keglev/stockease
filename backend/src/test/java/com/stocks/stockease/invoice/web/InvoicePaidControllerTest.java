package com.stocks.stockease.invoice.web;

import static com.stocks.stockease.invoice.web.InvoiceTestFixtures.csrfToken;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.anyLong;
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
import com.stocks.stockease.security.UserService;
import com.stocks.stockease.shared.InvoiceStateException;

import jakarta.persistence.EntityNotFoundException;

/** Slice tests for PATCH /api/invoices/{id}/paid, the admin-only payment stamp. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(InvoiceController.class)
@Import({TestConfig.class, InvoiceMethodSecurityTestConfig.class})
class InvoicePaidControllerTest {

    @MockitoBean
    private InvoiceService invoiceService;

    @MockitoBean
    private UserService userService;

    @Autowired
    private MockMvc mockMvc;

    @SuppressWarnings("unused")
    @BeforeEach
    void setUpMocks() {
        // @MockitoBean stubs survive for the Spring context lifetime; explicit reset prevents state bleeding between tests
        Mockito.reset(invoiceService);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void markInvoiceAsPaid_asAdmin_returns200() throws Exception {
        Mockito.when(invoiceService.markAsPaid(1L))
                .thenReturn(InvoiceTestFixtures.purchaseInvoice(InvoiceStatus.CLOSED));

        mockMvc.perform(patch("/api/invoices/1/paid").with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Invoice marked as paid"))
                .andExpect(jsonPath("$.data.id").value(1));

        Mockito.verify(invoiceService).markAsPaid(1L);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void markInvoiceAsPaid_whenAlreadyPaid_returns409() throws Exception {
        Mockito.when(invoiceService.markAsPaid(1L))
                .thenThrow(new InvoiceStateException("Invoice is already marked as paid."));

        mockMvc.perform(patch("/api/invoices/1/paid").with(csrfToken()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Invoice is already marked as paid."));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void markInvoiceAsPaid_withUnknownId_returns404() throws Exception {
        Mockito.when(invoiceService.markAsPaid(9L))
                .thenThrow(new EntityNotFoundException("Invoice with ID 9 not found."));

        mockMvc.perform(patch("/api/invoices/9/paid").with(csrfToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Entity not found: Invoice with ID 9 not found."));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void markInvoiceAsPaid_asUserRole_returns403() throws Exception {
        mockMvc.perform(patch("/api/invoices/1/paid").with(csrfToken()))
                .andExpect(status().isForbidden());

        Mockito.verify(invoiceService, Mockito.never()).markAsPaid(anyLong());
    }

    @Test
    void markInvoiceAsPaid_asAnonymous_returns401() throws Exception {
        mockMvc.perform(patch("/api/invoices/1/paid").with(csrfToken()))
                .andExpect(status().isUnauthorized());

        Mockito.verify(invoiceService, Mockito.never()).markAsPaid(anyLong());
    }
}
