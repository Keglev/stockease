package com.stocks.stockease.invoice.web;

import com.stocks.stockease.shared.ApiErrorCodes;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.security.UserService;
import com.stocks.stockease.shared.InvoiceStateException;

import jakarta.persistence.EntityNotFoundException;

/** Slice tests for DELETE /api/invoices/{id}, admin-only and restricted to open invoices. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(InvoiceController.class)
@Import({TestConfig.class, InvoiceMethodSecurityTestConfig.class})
class InvoiceDeleteControllerTest {

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
        Mockito.reset(invoiceService);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void deleteInvoice_asAdmin_returns200() throws Exception {
        mockMvc.perform(delete("/api/invoices/1").with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Invoice with ID 1 has been successfully deleted."));

        Mockito.verify(invoiceService).deleteById(1L);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void deleteInvoice_whenClosed_returns409() throws Exception {
        Mockito.doThrow(new InvoiceStateException("Only open invoices can be deleted.",
                ApiErrorCodes.INVOICE_NOT_OPEN_FOR_DELETE, null))
                .when(invoiceService).deleteById(1L);

        mockMvc.perform(delete("/api/invoices/1").with(csrfToken()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Only open invoices can be deleted."))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void deleteInvoice_withUnknownId_returns404() throws Exception {
        Mockito.doThrow(new EntityNotFoundException("Invoice with ID 9 not found."))
                .when(invoiceService).deleteById(9L);

        mockMvc.perform(delete("/api/invoices/9").with(csrfToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Entity not found: Invoice with ID 9 not found."));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void deleteInvoice_asUserRole_returns403() throws Exception {
        mockMvc.perform(delete("/api/invoices/1").with(csrfToken()))
                .andExpect(status().isForbidden());

        Mockito.verify(invoiceService, Mockito.never()).deleteById(anyLong());
    }

    @Test
    void deleteInvoice_asAnonymous_returns401() throws Exception {
        mockMvc.perform(delete("/api/invoices/1").with(csrfToken()))
                .andExpect(status().isUnauthorized());

        Mockito.verify(invoiceService, Mockito.never()).deleteById(anyLong());
    }
}
