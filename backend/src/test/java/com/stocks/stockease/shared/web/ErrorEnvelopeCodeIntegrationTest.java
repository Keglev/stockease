package com.stocks.stockease.shared.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.stocks.stockease.customer.Customer;
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
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Pins the machine-readable {@code code} on the error envelope, through the real endpoint.
 *
 * <p>The return endpoint answers 409 for several different situations, and two of them call for
 * opposite advice: a deleted product is fixed by restoring it, a stock shortfall is not. Status
 * alone cannot tell them apart, so the client that has to choose between two translated messages
 * has nothing to branch on. These tests assert the field that gives it one.
 *
 * <p>Driven over HTTP rather than against the handler, because the claim being made is about what
 * a client receives: that the code survives serialization, that it is absent rather than null when
 * no code applies, and that the rest of the envelope is unchanged either way.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ErrorEnvelopeCodeIntegrationTest extends AbstractIntegrationTest {

    private static final String TESTER = "envelope-tester";

    @Autowired private SupplierService suppliers;
    @Autowired private CustomerService customers;
    @Autowired private ProductService products;
    @Autowired private InvoiceService invoices;
    @Autowired private UserRepository userRepository;
    @Autowired private MockMvc mockMvc;

    /** Own numbers and SKUs: this class shares its database with the rest of the suite. */
    private static final AtomicInteger N = new AtomicInteger();

    private User admin;

    @BeforeEach
    void setUp() {
        // The controller resolves the principal against a real row, so @WithMockUser alone is not enough.
        admin = userRepository.findByUsername(TESTER)
                .orElseGet(() -> userRepository.saveAndFlush(new User(TESTER, "hash", "ROLE_ADMIN")));
    }

    private String tag() {
        return "CODE-" + N.incrementAndGet();
    }

    private void settle(Invoice invoice) {
        invoices.close(invoice.getId(), admin);
        invoices.markAsPaid(invoice.getId());
    }

    private long firstItemId(Invoice invoice) {
        return invoices.findDetailById(invoice.getId()).orElseThrow().getItems().get(0).getId();
    }

    private String returnBody(long invoiceItemId, long productId, String reason, int quantity) {
        return """
                {"invoiceItemId":%d,"productId":%d,"reason":"%s","quantity":%d}"""
                .formatted(invoiceItemId, productId, reason, quantity);
    }

    /**
     * Buys a batch and sells all of it, both settled. Leaves the product live at zero stock, which is
     * the state both conflicts below are provoked from - one by deleting it, one by returning against
     * the purchase line that no longer has the units to give back.
     */
    private Sold buyAndSellOut(int quantity) {
        Supplier supplier = suppliers.create("Envelope Supplier " + tag(), null, null, "1 Main St", null);
        Product item = products.create("Envelope Widget " + tag(), "ENV-" + N.incrementAndGet(), 10.0);
        Invoice purchase = invoices.createInvoice(new CreateInvoiceCommand(InvoiceType.PURCHASE, tag(),
                supplier.getId(), null, LocalDate.now().plusDays(30), BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new CreateInvoiceCommand.ItemLine(item.getId(), quantity, new BigDecimal("10.00")))));
        settle(purchase);

        Customer customer = customers.create("Envelope Buyer " + tag(), null, null, "2 Main St", "Springfield");
        Invoice sale = invoices.createInvoice(new CreateInvoiceCommand(InvoiceType.SALE, tag(), null,
                customer.getId(), LocalDate.now().plusDays(30), BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new CreateInvoiceCommand.ItemLine(item.getId(), quantity, new BigDecimal("18.00")))));
        settle(sale);

        return new Sold(item, purchase, sale);
    }

    private record Sold(Product item, Invoice purchase, Invoice sale) {}

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void registerReturn_productSoftDeleted_answers409WithTheProductDeletedCode() throws Exception {
        Sold sold = buyAndSellOut(5);
        products.deleteById(sold.item().getId(), admin);

        mockMvc.perform(post("/api/returns").contentType(MediaType.APPLICATION_JSON)
                        .content(returnBody(firstItemId(sold.sale()), sold.item().getId(),
                                "RETURN_FROM_CUSTOMER", 2)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.PRODUCT_DELETED))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").value(nullValue()));

        // left restorable for the rest of the suite, and it proves the refusal changed nothing
        products.restore(sold.item().getId(), admin);
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void registerReturn_stockAlreadySoldOn_answers409WithTheInsufficientStockCode() throws Exception {
        Sold sold = buyAndSellOut(5);

        // The line still has all five units outstanding, so the cap allows this return; what stops it
        // is that the units are gone from stock. Same status as the case above, different situation.
        mockMvc.perform(post("/api/returns").contentType(MediaType.APPLICATION_JSON)
                        .content(returnBody(firstItemId(sold.purchase()), sold.item().getId(),
                                "RETURNED_TO_SUPPLIER", 2)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.INSUFFICIENT_STOCK))
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void registerReturn_capExceeded_answers409WithNoCodeFieldAtAll() throws Exception {
        Sold sold = buyAndSellOut(5);

        // The third 409 on this same endpoint, and one no client needs to branch on. It must
        // serialize without a code - and the rest of the envelope must be untouched by the field's
        // existence, which is the whole claim "optional" makes.
        String body = mockMvc.perform(post("/api/returns").contentType(MediaType.APPLICATION_JSON)
                        .content(returnBody(firstItemId(sold.sale()), sold.item().getId(),
                                "RETURN_FROM_CUSTOMER", 99)))
                .andExpect(status().isConflict())
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

    /** A live product holding the given name and SKU, for the collisions below to run into. */
    private Product live(String name, String sku) {
        return products.create(name, sku, 10.0);
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void createProduct_nameAlreadyLive_answers409WithTheDuplicateNameCodeAndTheName() throws Exception {
        String name = "Envelope Dup " + tag();
        live(name, "DUP-" + N.incrementAndGet());

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
        live("Envelope Sku " + tag(), sku);

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
        Product deleted = live(name, "RSTN-" + N.incrementAndGet());
        products.deleteById(deleted.getId(), admin);
        // the name is free once the row is soft-deleted, so a live product can take it and block the way back
        live(name, "RSTN-" + N.incrementAndGet());

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
        Product deleted = live("Envelope RestoreSku " + tag(), sku);
        products.deleteById(deleted.getId(), admin);
        live("Envelope RestoreSku " + tag(), sku);

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
        Product item = live("Envelope Dup Line " + tag(), "DUPINV-" + N.incrementAndGet());
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
    void registerReturn_capExceeded_answers409WithNoParamsFieldAtAll() throws Exception {
        Sold sold = buyAndSellOut(5);

        // The uncoded 409 again, now for the second optional field. Asserted on the raw JSON for the
        // same reason the code case is: a path assertion cannot tell an absent key from a null one,
        // and absent is the claim - params rides with a code and this failure has none.
        String body = mockMvc.perform(post("/api/returns").contentType(MediaType.APPLICATION_JSON)
                        .content(returnBody(firstItemId(sold.sale()), sold.item().getId(),
                                "RETURN_FROM_CUSTOMER", 99)))
                .andExpect(status().isConflict())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("params");
    }
}
