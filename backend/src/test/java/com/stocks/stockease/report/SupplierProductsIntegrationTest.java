package com.stocks.stockease.report;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import com.stocks.stockease.invoice.CreateInvoiceCommand;
import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Tests the supplier-scoped product search, whose whole subject is the purchase linkage: a product
 * belongs to a supplier because that supplier was invoiced for it, and nothing in master data says so.
 * Every method commits, so each owns its own supplier and asserts on that supplier's answer alone.
 */
@SpringBootTest
@ActiveProfiles("test")
class SupplierProductsIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ReportingService reportingService;

    @Autowired
    private ProductService productService;

    @Autowired
    private InvoiceService invoiceService;

    @Autowired
    private SupplierService supplierService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User user;

    @BeforeEach
    void setUp() {
        user = userRepository.findByUsername("supplier-products-tester")
                .orElseGet(() -> userRepository.saveAndFlush(
                        new User("supplier-products-tester", "hash", "ROLE_ADMIN")));
    }

    /** Numbers and SKUs are unique among live rows, and these tests commit, so each takes a fresh one. */
    private static final AtomicInteger SEQ = new AtomicInteger();

    private Product newProduct(String name) {
        return productService.create(name, "SP-" + SEQ.incrementAndGet(), 5.0);
    }

    private Supplier newSupplier(String name) {
        return supplierService.create(name, null, null, "1 Main St", null);
    }

    /** Books a closed purchase, which is the only thing that makes a product this supplier's. */
    private Invoice bought(Supplier supplier, Product product, int quantity) {
        Invoice purchase = invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.PURCHASE,
                "TST-SP-" + SEQ.incrementAndGet(), supplier.getId(), null, LocalDate.now(), null, null,
                List.of(new CreateInvoiceCommand.ItemLine(product.getId(), quantity, new BigDecimal("5.00")))));
        invoiceService.close(purchase.getId(), user);
        return purchase;
    }

    private List<String> namesFor(long supplierId, String term) {
        return reportingService.supplierProducts(supplierId, term).orElseThrow()
                .stream().map(SupplierProduct::name).toList();
    }

    @Test
    void supplierProducts_twoSuppliers_returnsOnlyTheOneAsked() {
        String token = "SPScope" + SEQ.incrementAndGet();
        Supplier north = newSupplier(token + " North");
        Supplier south = newSupplier(token + " South");
        Product fromNorth = newProduct(token + " Widget");
        bought(north, fromNorth, 5);
        bought(south, newProduct(token + " Gadget"), 5);

        // the other supplier's product is not this supplier's, however similar the name
        assertThat(namesFor(north.getId(), token)).containsExactly(fromNorth.getName());
    }

    @Test
    void supplierProducts_boughtRepeatedly_appearsOnce() {
        String token = "SPRepeat" + SEQ.incrementAndGet();
        Supplier supplier = newSupplier(token + " Supplier");
        Product product = newProduct(token + " Widget");
        bought(supplier, product, 5);
        bought(supplier, product, 7);
        bought(supplier, product, 3);

        // DISTINCT is what makes this a picker rather than a purchase history
        assertThat(namesFor(supplier.getId(), token)).containsExactly(product.getName());
    }

    @Test
    void supplierProducts_boughtFromTwoSuppliers_appearsUnderBoth() {
        String token = "SPShared" + SEQ.incrementAndGet();
        Supplier first = newSupplier(token + " First");
        Supplier second = newSupplier(token + " Second");
        Product shared = newProduct(token + " Widget");
        bought(first, shared, 4);
        bought(second, shared, 6);

        // correct rather than a duplicate to resolve: both suppliers really did sell it to us
        assertThat(namesFor(first.getId(), token)).containsExactly(shared.getName());
        assertThat(namesFor(second.getId(), token)).containsExactly(shared.getName());
    }

    @Test
    void supplierProducts_nameSubstringInAnyCase_narrowsTheList() {
        String token = "SPTerm" + SEQ.incrementAndGet();
        Supplier supplier = newSupplier(token + " Supplier");
        Product widget = newProduct(token + " Widget");
        bought(supplier, widget, 5);
        bought(supplier, newProduct(token + " Gadget"), 5);

        assertThat(namesFor(supplier.getId(), "widget")).containsExactly(widget.getName());
    }

    @Test
    void supplierProducts_deletedPurchaseInvoice_stopsLinkingTheProduct() {
        String token = "SPVoid" + SEQ.incrementAndGet();
        Supplier supplier = newSupplier(token + " Supplier");
        Product product = newProduct(token + " Widget");
        Invoice purchase = bought(supplier, product, 5);
        // Stamped in SQL rather than through the service, which refuses to delete a closed invoice.
        // The predicate under test reads the column, and this is the only way to put a closed
        // purchase behind it - the same reason CashFlowIntegrationTest backdates payments directly.
        jdbcTemplate.update("UPDATE invoice SET deleted_at = now() WHERE id = ?", purchase.getId());

        // a voided purchase never happened, so it cannot be what makes this product the supplier's
        assertThat(namesFor(supplier.getId(), token)).isEmpty();
    }

    @Test
    void supplierProducts_supplierWithNoPurchases_returnsEmptyNotAbsent() {
        Supplier supplier = newSupplier("SPBare" + SEQ.incrementAndGet() + " Supplier");

        // a real supplier that has sold us nothing is an empty list, which is not a 404
        assertThat(reportingService.supplierProducts(supplier.getId(), "anything")).contains(List.of());
    }

    @Test
    void supplierProducts_unknownSupplier_returnsEmptyOptional() {
        assertThat(reportingService.supplierProducts(999_999L, "anything")).isEmpty();
    }
}
