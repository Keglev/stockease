package com.stocks.stockease.invoice.web;

import static com.stocks.stockease.invoice.web.InvoiceTestFixtures.applicationJson;
import static com.stocks.stockease.invoice.web.InvoiceTestFixtures.csrfToken;
import static com.stocks.stockease.invoice.web.InvoiceTestFixtures.validCreateBody;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stocks.stockease.config.test.TestConfig;
import com.stocks.stockease.invoice.CreateInvoiceCommand;
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.security.UserService;

/** Slice tests for POST /api/invoices (invoice creation and its request validation). */
@ExtendWith(MockitoExtension.class)
@WebMvcTest(InvoiceController.class)
@Import({TestConfig.class, InvoiceMethodSecurityTestConfig.class})
class InvoiceCreateControllerTest {

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
    void createInvoice_withValidBody_mapsRequestToCommand() throws Exception {
        Mockito.when(invoiceService.createInvoice(any(CreateInvoiceCommand.class)))
                .thenReturn(InvoiceTestFixtures.purchaseInvoice(InvoiceStatus.OPEN));

        mockMvc.perform(post("/api/invoices")
                        .contentType(applicationJson()).content(validCreateBody()).with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.invoiceNumber").value("RE-2026-0117"))
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.supplierId").value(7));

        assertCapturedCommand();
    }

    /** Asserts the command handed to the service carries the request's type, counterparty and lines. */
    private void assertCapturedCommand() {
        ArgumentCaptor<CreateInvoiceCommand> captor = ArgumentCaptor.forClass(CreateInvoiceCommand.class);
        Mockito.verify(invoiceService).createInvoice(captor.capture());
        CreateInvoiceCommand command = captor.getValue();

        assertThat(command.type()).isEqualTo(InvoiceType.PURCHASE);
        assertThat(command.invoiceNumber()).isEqualTo("RE-2026-0117");
        assertThat(command.supplierId()).isEqualTo(7L);
        assertThat(command.customerId()).isNull();
        assertThat(command.dueDate()).isEqualTo(InvoiceTestFixtures.DUE_DATE);
        assertThat(command.items()).singleElement().satisfies(line -> {
            assertThat(line.productId()).isEqualTo(3L);
            assertThat(line.quantity()).isEqualTo(2);
            assertThat(line.unitPrice()).isEqualByComparingTo("15.00");
        });
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void createInvoice_asUserRole_returns200() throws Exception {
        Mockito.when(invoiceService.createInvoice(any(CreateInvoiceCommand.class)))
                .thenReturn(InvoiceTestFixtures.purchaseInvoice(InvoiceStatus.OPEN));

        mockMvc.perform(post("/api/invoices")
                        .contentType(applicationJson()).content(validCreateBody()).with(csrfToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createInvoice_withMissingType_returns400() throws Exception {
        performInvalid("{\"dueDate\": \"2026-03-01\","
                + " \"items\": [{\"productId\": 3, \"quantity\": 2, \"unitPrice\": 15.00}]}", "type",
                "Invoice type is required.");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createInvoice_withMissingInvoiceNumber_returns400() throws Exception {
        // both @NotNull and @NotBlank fire on a missing value and the handler joins their messages,
        // so this asserts the field is rejected and why, without pinning the join
        mockMvc.perform(post("/api/invoices").contentType(applicationJson()).with(csrfToken())
                        .content("{\"type\": \"PURCHASE\", \"supplierId\": 7, \"dueDate\": \"2026-03-01\","
                                + " \"items\": [{\"productId\": 3, \"quantity\": 2, \"unitPrice\": 15.00}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data['invoiceNumber']").value(
                        org.hamcrest.Matchers.containsString("Invoice number is required.")));

        Mockito.verify(invoiceService, Mockito.never()).createInvoice(any(CreateInvoiceCommand.class));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createInvoice_withBlankInvoiceNumber_returns400() throws Exception {
        performInvalid("{\"type\": \"PURCHASE\", \"invoiceNumber\": \"  \", \"supplierId\": 7,"
                + " \"dueDate\": \"2026-03-01\","
                + " \"items\": [{\"productId\": 3, \"quantity\": 2, \"unitPrice\": 15.00}]}", "invoiceNumber",
                "Invoice number is required.");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createInvoice_withMissingDueDate_returns400() throws Exception {
        performInvalid("{\"type\": \"PURCHASE\", \"supplierId\": 7,"
                + " \"items\": [{\"productId\": 3, \"quantity\": 2, \"unitPrice\": 15.00}]}", "dueDate",
                "Due date is required.");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createInvoice_withEmptyItems_returns400() throws Exception {
        performInvalid("{\"type\": \"PURCHASE\", \"supplierId\": 7, \"dueDate\": \"2026-03-01\", \"items\": []}",
                "items", "An invoice requires at least one item.");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createInvoice_withNonPositiveQuantity_returns400() throws Exception {
        performInvalid("{\"type\": \"PURCHASE\", \"supplierId\": 7, \"dueDate\": \"2026-03-01\","
                + " \"items\": [{\"productId\": 3, \"quantity\": 0, \"unitPrice\": 15.00}]}",
                "items[0].quantity", "Item quantity must be positive.");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createInvoice_withNonPositiveUnitPrice_returns400() throws Exception {
        performInvalid("{\"type\": \"PURCHASE\", \"supplierId\": 7, \"dueDate\": \"2026-03-01\","
                + " \"items\": [{\"productId\": 3, \"quantity\": 2, \"unitPrice\": 0}]}",
                "items[0].unitPrice", "Item unit price must be positive.");
    }

    @Test
    void createInvoice_asAnonymous_returns401() throws Exception {
        mockMvc.perform(post("/api/invoices")
                        .contentType(applicationJson()).content(validCreateBody()).with(csrfToken()))
                .andExpect(status().isUnauthorized());
    }

    /** Posts a body expected to fail validation before the service is ever consulted. */
    private void performInvalid(String body, String field, String message) throws Exception {
        // quoted-key notation: nested field names like "items[0].quantity" are literal map keys, and
        // dotted notation would make JsonPath read them as an array index instead
        mockMvc.perform(post("/api/invoices")
                        .contentType(applicationJson()).content(body).with(csrfToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for request parameters."))
                .andExpect(jsonPath("$.data['" + field + "']").value(message));

        Mockito.verify(invoiceService, Mockito.never()).createInvoice(any(CreateInvoiceCommand.class));
    }
}
