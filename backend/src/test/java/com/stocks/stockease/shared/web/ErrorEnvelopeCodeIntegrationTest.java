package com.stocks.stockease.shared.web;

import static com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.N;
import static com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.TESTER;
import static com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.returnBody;
import static com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.tag;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.stocks.stockease.customer.CustomerService;
import com.stocks.stockease.invoice.CreateInvoiceCommand;
import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.shared.ApiErrorCodes;
import com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.Sold;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Pins the machine-readable {@code code} on the error envelope, through the real endpoint.
 *
 * <p>Covers the duplicate-resource and invoice-state families, whose situations share a status and
 * differ in what they ask the operator to do, and the two guards that pin what the envelope does
 * when no code applies at all.
 *
 * <p>Sibling of {@link ErrorEnvelopeEntityInUseIntegrationTest}, which covers the entity-in-use
 * family. The split is by family, and the annotation block above is byte-identical to that file's
 * on purpose: Spring caches a context by its configuration, so identical annotations mean both
 * classes are served by one application context rather than paying to build a second. Anything
 * shared between them lives in {@link ErrorEnvelopeTestFixtures} - in particular the counter,
 * because these tests commit.
 *
 * <p>Driven over HTTP rather than against the handler, because the claim being made is about what
 * a client receives: that the code survives serialization, that it is absent rather than null when
 * no code applies, and that the rest of the envelope is unchanged either way.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ErrorEnvelopeCodeIntegrationTest extends AbstractIntegrationTest {

    @Autowired private SupplierService suppliers;
    @Autowired private CustomerService customers;
    @Autowired private ProductService products;
    @Autowired private InvoiceService invoices;
    @Autowired private UserRepository userRepository;
    @Autowired private MockMvc mockMvc;

    private ErrorEnvelopeTestFixtures fixtures;
    private User admin;

    @BeforeEach
    void setUp() {
        fixtures = new ErrorEnvelopeTestFixtures(suppliers, customers, products, invoices, userRepository);
        admin = fixtures.admin;
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void getInvoice_unknownId_answers404WithNoCodeFieldAtAll() throws Exception {
        // The claim is about envelope serialization, not about this status: an optional field must be
        // an absent key rather than a present null, and data must still serialize as null beside it.
        // Pinned on a not-found rather than on a conflict because no planned ADR 041 family covers
        // EntityNotFound, so this guard never has to move again - where the 409 families are being
        // coded one phase at a time, and this test had to move once already when its old target
        // gained a code.
        String body = mockMvc.perform(get("/api/invoices/999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").exists())
                .andExpect(jsonPath("$.data").value(nullValue()))
                .andReturn().getResponse().getContentAsString();

        // Asserted on the raw JSON, not through jsonPath: a path assertion cannot tell an absent key
        // from one present with a null value, and that distinction is exactly what is being claimed.
        // data is null and still serialized, so this also shows the omission is the field's own
        // @JsonInclude and not a global null-stripping rule that would have changed every response.
        assertThat(body).doesNotContain("code").contains("\"data\":null");
    }

    private String productBody(String name, String sku) {
        return """
                {"name":"%s","sku":"%s","purchasePrice":10.0}""".formatted(name, sku);
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void createProduct_nameAlreadyLive_answers409WithTheDuplicateNameCodeAndTheName() throws Exception {
        String name = "Envelope Dup " + tag();
        fixtures.live(name, "DUP-" + N.incrementAndGet());

        mockMvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON)
                        .content(productBody(name, "DUP-" + N.incrementAndGet())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("A product named '" + name + "' already exists."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.DUPLICATE_PRODUCT_NAME))
                .andExpect(jsonPath("$.params.name").value(name));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void createProduct_skuAlreadyLive_answers409WithTheDuplicateSkuCodeAndTheSku() throws Exception {
        String sku = "DUPSKU-" + N.incrementAndGet();
        fixtures.live("Envelope Sku " + tag(), sku);

        mockMvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON)
                        .content(productBody("Envelope Sku " + tag(), sku)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("A product with SKU '" + sku + "' already exists."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.DUPLICATE_PRODUCT_SKU))
                .andExpect(jsonPath("$.params.sku").value(sku));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void restoreProduct_nameTakenByALiveProduct_answers409WithTheRestoreBlockedByNameCode() throws Exception {
        String name = "Envelope Restore " + tag();
        Product deleted = fixtures.live(name, "RSTN-" + N.incrementAndGet());
        products.deleteById(deleted.getId(), admin);
        // the name is free once the row is soft-deleted, so a live product can take it and block the way back
        fixtures.live(name, "RSTN-" + N.incrementAndGet());

        mockMvc.perform(post("/api/products/" + deleted.getId() + "/restore"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message")
                        .value("Cannot restore: a live product named '" + name + "' already exists."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.RESTORE_BLOCKED_BY_NAME))
                .andExpect(jsonPath("$.params.name").value(name));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void restoreProduct_skuTakenByALiveProduct_answers409WithTheRestoreBlockedBySkuCode() throws Exception {
        String sku = "RSTS-" + N.incrementAndGet();
        Product deleted = fixtures.live("Envelope RestoreSku " + tag(), sku);
        products.deleteById(deleted.getId(), admin);
        fixtures.live("Envelope RestoreSku " + tag(), sku);

        mockMvc.perform(post("/api/products/" + deleted.getId() + "/restore"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message")
                        .value("Cannot restore: a live product with SKU '" + sku + "' already exists."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.RESTORE_BLOCKED_BY_SKU))
                .andExpect(jsonPath("$.params.sku").value(sku));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void createInvoice_numberAlreadyUsed_answers409WithTheDuplicateNumberCodeAndTheNumber() throws Exception {
        Supplier supplier = suppliers.create("Envelope Dup Supplier " + tag(), null, null, "1 Main St", null);
        Product item = fixtures.live("Envelope Dup Line " + tag(), "DUPINV-" + N.incrementAndGet());
        String number = tag();
        invoices.createInvoice(new CreateInvoiceCommand(InvoiceType.PURCHASE, number, supplier.getId(), null,
                LocalDate.now().plusDays(30), BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new CreateInvoiceCommand.ItemLine(item.getId(), 1, new BigDecimal("10.00")))));

        String body = """
                {"type":"PURCHASE","invoiceNumber":"%s","supplierId":%d,"dueDate":"%s",
                 "interestRate":0,"fineValue":0,"items":[{"productId":%d,"quantity":1,"unitPrice":10.00}]}"""
                .formatted(number, supplier.getId(), LocalDate.now().plusDays(30), item.getId());

        mockMvc.perform(post("/api/invoices").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("An invoice numbered '" + number + "' already exists."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.DUPLICATE_INVOICE_NUMBER))
                .andExpect(jsonPath("$.params.invoiceNumber").value(number));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void getInvoice_unknownId_answers404WithNoParamsFieldAtAll() throws Exception {
        // The same serialization claim for the second optional field, on the same deliberately
        // uncoded situation: params rides with a code and this failure has none.
        String body = mockMvc.perform(get("/api/invoices/999999"))
                .andExpect(status().isNotFound())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("params");
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void closeInvoice_alreadyClosed_answers409WithTheNotOpenForCloseCode() throws Exception {
        Invoice closed = fixtures.settledPurchase(3);

        mockMvc.perform(patch("/api/invoices/" + closed.getId() + "/close"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Only open invoices can be closed."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.INVOICE_NOT_OPEN_FOR_CLOSE));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void markAsPaid_alreadyPaid_answers409WithTheAlreadyPaidCode() throws Exception {
        Invoice paid = fixtures.settledPurchase(3);

        mockMvc.perform(patch("/api/invoices/" + paid.getId() + "/paid"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Invoice is already marked as paid."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.INVOICE_ALREADY_PAID));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void deleteInvoice_alreadyClosed_answers409WithTheNotOpenForDeleteCode() throws Exception {
        Invoice closed = fixtures.settledPurchase(3);

        mockMvc.perform(delete("/api/invoices/" + closed.getId()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Only open invoices can be deleted."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.INVOICE_NOT_OPEN_FOR_DELETE));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void registerReturn_moreThanTheLineHasLeft_answers409WithTheExceedsCodeAndTheNumbers() throws Exception {
        Sold sold = fixtures.buyAndSellOut(5);
        long itemId = fixtures.firstItemId(sold.sale());

        mockMvc.perform(post("/api/returns").contentType(MediaType.APPLICATION_JSON)
                        .content(returnBody(itemId, sold.item().getId(), "RETURN_FROM_CUSTOMER", 9)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message")
                        .value("Return of 9 exceeds remaining returnable quantity 5 for invoice item " + itemId + "."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.RETURN_EXCEEDS_RETURNABLE))
                // The only situation in this family carrying params: a client rendering its own
                // sentence needs the numbers the server put in its.
                .andExpect(jsonPath("$.params.quantity").value("9"))
                .andExpect(jsonPath("$.params.remaining").value("5"))
                .andExpect(jsonPath("$.params.itemId").value(String.valueOf(itemId)));
    }
}
