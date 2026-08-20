package com.stocks.stockease.shared.web;

import static com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.TESTER;
import static com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.returnBody;
import static com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.tag;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import com.stocks.stockease.invoice.InvoiceService;
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
 * Pins the {@code code} and {@code params} on every refusal the entity-in-use family raises,
 * through the real endpoint.
 *
 * <p>Four of them are about a record something else still needs: open invoices pinning a supplier,
 * a customer or a product, and a product still holding stock. The other two are the soft-delete
 * pair on the return endpoint, which reach the same 409 from the same family and call for opposite
 * advice - restore the product, or do not, depending which one it is. Status alone cannot tell any
 * of them apart, so the client choosing between six translated sentences has nothing to branch on
 * but the field these tests assert.
 *
 * <p>Sibling of {@link ErrorEnvelopeCodeIntegrationTest}, which covers the duplicate-resource and
 * invoice-state families and the two absence guards. The split is by family, and the annotation
 * block above is byte-identical to that file's on purpose: Spring caches a context by its
 * configuration, so identical annotations mean both classes are served by one application context
 * rather than paying to build a second. Anything shared between them lives in
 * {@link ErrorEnvelopeTestFixtures} - in particular the counter, because these tests commit.
 *
 * <p>Driven over HTTP rather than against the handler, because the claim being made is about what
 * a client receives.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ErrorEnvelopeEntityInUseIntegrationTest extends AbstractIntegrationTest {

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
    void registerReturn_productSoftDeleted_answers409WithTheProductDeletedCode() throws Exception {
        Sold sold = fixtures.buyAndSellOut(5);
        products.deleteById(sold.item().getId(), admin);

        mockMvc.perform(post("/api/returns").contentType(MediaType.APPLICATION_JSON)
                        .content(returnBody(fixtures.firstItemId(sold.sale()), sold.item().getId(),
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
        Sold sold = fixtures.buyAndSellOut(5);

        // The line still has all five units outstanding, so the cap allows this return; what stops it
        // is that the units are gone from stock. Same status as the case above, different situation.
        mockMvc.perform(post("/api/returns").contentType(MediaType.APPLICATION_JSON)
                        .content(returnBody(fixtures.firstItemId(sold.purchase()), sold.item().getId(),
                                "RETURNED_TO_SUPPLIER", 2)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.INSUFFICIENT_STOCK))
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void deleteSupplier_withAnOpenInvoice_answers409WithTheSupplierCodeAndName() throws Exception {
        Supplier supplier = fixtures.supplier("Envelope Pinned Supplier");
        Product item = fixtures.live("Envelope Pinned Line " + tag(), "PINS-" + ErrorEnvelopeTestFixtures.N.incrementAndGet());
        // Left OPEN: closing is what releases the party, so an unsettled invoice is the veto's whole premise.
        fixtures.openPurchase(supplier, item, 2);

        mockMvc.perform(delete("/api/suppliers/" + supplier.getId()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message")
                        .value("Cannot delete supplier '" + supplier.getName() + "': open invoices exist."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.SUPPLIER_HAS_OPEN_INVOICES))
                .andExpect(jsonPath("$.params.supplierName").value(supplier.getName()));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void deleteCustomer_withAnOpenInvoice_answers409WithTheCustomerCodeAndName() throws Exception {
        Customer customer = fixtures.customer("Envelope Pinned Customer");
        Product item = fixtures.live("Envelope Pinned Sale Line " + tag(), "PINC-" + ErrorEnvelopeTestFixtures.N.incrementAndGet());
        fixtures.openSale(customer, item, 1);

        mockMvc.perform(delete("/api/customers/" + customer.getId()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message")
                        .value("Cannot delete customer '" + customer.getName() + "': open invoices exist."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.CUSTOMER_HAS_OPEN_INVOICES))
                .andExpect(jsonPath("$.params.customerName").value(customer.getName()));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void deleteProduct_onAnOpenInvoice_answers409WithTheOpenInvoiceCodeAndName() throws Exception {
        Supplier supplier = fixtures.supplier("Envelope Pinned Product Supplier");
        Product item = fixtures.live("Envelope Pinned Product " + tag(), "PINP-" + ErrorEnvelopeTestFixtures.N.incrementAndGet());
        // The invoice stays open, so it never books stock and the product sits at zero. That ordering
        // matters: the service refuses a stocked product before it publishes the event this veto
        // listens for, so a stocked product here would raise the other code and prove nothing.
        fixtures.openPurchase(supplier, item, 2);

        mockMvc.perform(delete("/api/products/" + item.getId()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message")
                        .value("Cannot delete product '" + item.getName() + "': it appears on an open invoice."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.PRODUCT_ON_OPEN_INVOICE))
                .andExpect(jsonPath("$.params.productName").value(item.getName()));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void deleteProduct_stillHoldingStock_answers409WithTheStockCodeAndTheQuantity() throws Exception {
        Product item = fixtures.stockedProduct(7);

        mockMvc.perform(delete("/api/products/" + item.getId()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message")
                        .value("Cannot delete product '" + item.getName() + "': 7 units are still in stock."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.PRODUCT_HAS_STOCK))
                // The only refusal in this family whose params carry more than a name: a client
                // rendering its own sentence needs the count the server put in its.
                .andExpect(jsonPath("$.params.productName").value(item.getName()))
                .andExpect(jsonPath("$.params.quantity").value("7"));
    }
}
