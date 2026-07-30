package com.stocks.stockease.invoice.web;

import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.security.UserService;

import static org.assertj.core.api.Assertions.assertThat;

/** Slice tests for GET /api/invoices/paged. */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(InvoiceController.class)
@Import({TestConfig.class, InvoiceMethodSecurityTestConfig.class})
class InvoicePaginationControllerTest {

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

    /** One page of two invoices out of a ledger of twenty-five. */
    private static Page<Invoice> page(int number, int size) {
        List<Invoice> invoices = List.of(
                InvoiceTestFixtures.saleInvoice(InvoiceStatus.OPEN),
                InvoiceTestFixtures.purchaseInvoice(InvoiceStatus.CLOSED));
        return new PageImpl<>(invoices, PageRequest.of(number, size), 25);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getPagedInvoices_withValidParams_returnsSliceAndMetadata() throws Exception {
        Mockito.when(invoiceService.findAll(Mockito.any(Pageable.class))).thenReturn(page(1, 10));

        mockMvc.perform(get("/api/invoices/paged").param("page", "1").param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content", hasSize(2)))
                .andExpect(jsonPath("$.data.content[0].type").value("SALE"))
                .andExpect(jsonPath("$.data.pageNumber").value(1))
                .andExpect(jsonPath("$.data.totalElements").value(25))
                .andExpect(jsonPath("$.data.totalPages").value(3));
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void getPagedInvoices_withoutParams_appliesFirstPageOfTen() throws Exception {
        Mockito.when(invoiceService.findAll(Mockito.any(Pageable.class))).thenReturn(page(0, 10));

        mockMvc.perform(get("/api/invoices/paged")).andExpect(status().isOk());

        // captured rather than assumed: the defaults live in the annotations and would drift silently
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        Mockito.verify(invoiceService).findAll(pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(pageable.getValue().getPageSize()).isEqualTo(10);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getPagedInvoices_withExplicitParams_passesThemThrough() throws Exception {
        Mockito.when(invoiceService.findAll(Mockito.any(Pageable.class))).thenReturn(page(2, 5));

        mockMvc.perform(get("/api/invoices/paged").param("page", "2").param("size", "5"))
                .andExpect(status().isOk());

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        Mockito.verify(invoiceService).findAll(pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isEqualTo(2);
        assertThat(pageable.getValue().getPageSize()).isEqualTo(5);
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getPagedInvoices_withNegativeParams_returns400() throws Exception {
        mockMvc.perform(get("/api/invoices/paged").param("page", "-1").param("size", "-10"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        Mockito.verify(invoiceService, Mockito.never()).findAll(Mockito.any(Pageable.class));
    }

    @Test
    void getPagedInvoices_asAnonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/invoices/paged")).andExpect(status().isUnauthorized());

        Mockito.verify(invoiceService, Mockito.never()).findAll(Mockito.any(Pageable.class));
    }
}
