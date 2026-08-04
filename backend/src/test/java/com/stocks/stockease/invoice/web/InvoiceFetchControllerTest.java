package com.stocks.stockease.invoice.web;

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
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.security.UserService;

/** Slice tests for GET /api/invoices and GET /api/invoices/{id}. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(InvoiceController.class)
@Import({TestConfig.class, InvoiceMethodSecurityTestConfig.class})
class InvoiceFetchControllerTest {

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
    void getAllInvoices_asAdmin_returnsSummariesInServiceOrder() throws Exception {
        Mockito.when(invoiceService.findAll()).thenReturn(List.of(
                InvoiceTestFixtures.saleInvoice(InvoiceStatus.OPEN),
                InvoiceTestFixtures.purchaseInvoice(InvoiceStatus.CLOSED)));

        mockMvc.perform(get("/api/invoices"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(2))
                .andExpect(jsonPath("$[0].type").value("SALE"))
                .andExpect(jsonPath("$[0].customerId").value(9))
                .andExpect(jsonPath("$[0].supplierId").doesNotExist())
                .andExpect(jsonPath("$[1].id").value(1))
                .andExpect(jsonPath("$[1].supplierId").value(7));

        Mockito.verify(invoiceService).findAll();
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getAllInvoices_summaryShape_omitsCounterpartyNamesAndItems() throws Exception {
        Mockito.when(invoiceService.findAll())
                .thenReturn(List.of(InvoiceTestFixtures.purchaseInvoice(InvoiceStatus.OPEN)));

        // names and items belong to the detail response only; the list must stay proxy-safe
        mockMvc.perform(get("/api/invoices"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].supplierName").doesNotExist())
                .andExpect(jsonPath("$[0].items").doesNotExist());
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void getAllInvoices_asUserRole_returns200() throws Exception {
        Mockito.when(invoiceService.findAll())
                .thenReturn(List.of(InvoiceTestFixtures.purchaseInvoice(InvoiceStatus.OPEN)));

        mockMvc.perform(get("/api/invoices"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1));
    }

    @Test
    void getAllInvoices_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/invoices"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void getInvoiceById_withExistingId_returnsDetailWithItemsAndNames() throws Exception {
        Mockito.when(invoiceService.findDetailById(1L))
                .thenReturn(Optional.of(InvoiceTestFixtures.purchaseInvoice(InvoiceStatus.OPEN)));

        mockMvc.perform(get("/api/invoices/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Invoice fetched successfully"))
                .andExpect(jsonPath("$.data.supplierName").value("Acme"))
                .andExpect(jsonPath("$.data.items[0].productName").value("Widget"))
                .andExpect(jsonPath("$.data.items[0].quantity").value(2))
                .andExpect(jsonPath("$.data.items[0].returnedQty").value(0));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void getInvoiceById_withSaleInvoice_returnsTheCustomerAndNoSupplier() throws Exception {
        // the mirror of the purchase case: a sale carries no supplier, and the detail must render the
        // counterparty it does have rather than failing on the one it does not
        Mockito.when(invoiceService.findDetailById(2L))
                .thenReturn(Optional.of(InvoiceTestFixtures.saleInvoice(InvoiceStatus.OPEN)));

        mockMvc.perform(get("/api/invoices/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.customerId").value(9))
                .andExpect(jsonPath("$.data.customerName").value("Jane Doe"))
                .andExpect(jsonPath("$.data.supplierId").doesNotExist())
                .andExpect(jsonPath("$.data.supplierName").doesNotExist());
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void getInvoiceById_withUnknownId_returns404() throws Exception {
        Mockito.when(invoiceService.findDetailById(9L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/invoices/9"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Entity not found: Invoice with ID 9 not found."));
    }

    @Test
    void getInvoiceById_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/invoices/1"))
                .andExpect(status().isUnauthorized());
    }
}
