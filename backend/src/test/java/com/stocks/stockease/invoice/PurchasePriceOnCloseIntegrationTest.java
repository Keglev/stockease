package com.stocks.stockease.invoice;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.internal.ProductRepository;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.internal.SupplierRepository;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Pins the last-purchase-price rule (ADR 019) against PostgreSQL: closing a purchase invoice moves each
 * product's price to what that invoice paid, and records the move in the product change log through the
 * same audited path the price endpoint uses. Every method runs outside a test transaction, so the
 * assertions observe committed state rather than the test's own session.
 */
@SpringBootTest
@ActiveProfiles("test")
class PurchasePriceOnCloseIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private InvoiceService invoiceService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User user;

    @BeforeEach
    void setUp() {
        // these tests commit, so the shared user is reused rather than re-inserted
        user = userRepository.findByUsername("reprice-tester")
                .orElseGet(() -> userRepository.saveAndFlush(new User("reprice-tester", "hash", "ROLE_ADMIN")));
    }

    /** Creates a live product at {@code price}, stocked so a sale can also be closed against it. */
    private Product newProduct(String name, String price) {
        Product product = new Product(name, 20, new BigDecimal(price).doubleValue());
        product.setSku("TST-PRICE-" + name.hashCode());
        return productRepository.saveAndFlush(product);
    }

    private Supplier newSupplier() {
        return supplierRepository.saveAndFlush(new Supplier(null, "Reprice Supplier", null, null, "1 Main St", null, null, null));
    }

    private static CreateInvoiceCommand.ItemLine line(Product product, String unitPrice) {
        return new CreateInvoiceCommand.ItemLine(product.getId(), 2, new BigDecimal(unitPrice));
    }

    /** Numbers are unique among live invoices, and these tests commit, so each takes a fresh one. */
    private static final AtomicInteger NUMBERS = new AtomicInteger();

    private static String nextNumber() {
        return "TST-PRICE-" + NUMBERS.incrementAndGet();
    }

    private Invoice purchase(CreateInvoiceCommand.ItemLine... lines) {
        return invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.PURCHASE, nextNumber(),
                newSupplier().getId(), null, LocalDate.now(), null, null, List.of(lines)));
    }

    private Invoice sale(CreateInvoiceCommand.ItemLine... lines) {
        return invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.SALE, nextNumber(), null, null,
                LocalDate.now(), null, null, List.of(lines)));
    }

    private BigDecimal priceOf(Long productId) {
        return productRepository.findById(productId).orElseThrow().getPurchasePrice();
    }

    /** Every PURCHASE_PRICE audit row for a product, oldest first, as raw columns. */
    private List<Map<String, Object>> priceLog(Long productId) {
        return jdbcTemplate.queryForList(
                "SELECT old_value, new_value, user_id FROM product_change_log "
                        + "WHERE product_id = ? AND field = 'PURCHASE_PRICE' ORDER BY id", productId);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void close_purchaseInvoiceWithNewPrice_updatesProductAndWritesChangeLog() {
        Product product = newProduct("Reprice New Price", "5.00");
        Invoice invoice = purchase(line(product, "7.25"));

        invoiceService.close(invoice.getId(), user);

        assertThat(priceOf(product.getId())).isEqualByComparingTo("7.25");
        assertThat(priceLog(product.getId())).singleElement().satisfies(row -> {
            assertThat(new BigDecimal((String) row.get("old_value"))).isEqualByComparingTo("5.00");
            assertThat(new BigDecimal((String) row.get("new_value"))).isEqualByComparingTo("7.25");
            assertThat(row.get("user_id")).isEqualTo(user.getId());
        });
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void close_purchaseInvoiceWithUnchangedPrice_writesNoChangeLogRow() {
        Product product = newProduct("Reprice Unchanged", "5.00");
        Invoice invoice = purchase(line(product, "5.00"));

        invoiceService.close(invoice.getId(), user);

        assertThat(priceOf(product.getId())).isEqualByComparingTo("5.00");
        // the vacuity guard: re-stating the price a product already carries is not a change to audit
        assertThat(priceLog(product.getId())).isEmpty();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void close_saleInvoice_leavesPurchasePriceUntouched() {
        Product product = newProduct("Reprice Sale Close", "5.00");
        Invoice invoice = sale(line(product, "99.00"));

        invoiceService.close(invoice.getId(), user);

        // a sale price is what the customer paid, and says nothing about what the product costs
        assertThat(priceOf(product.getId())).isEqualByComparingTo("5.00");
        assertThat(priceLog(product.getId())).isEmpty();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void close_secondPurchaseAtNewPrice_lastClosedInvoiceWins() {
        Product product = newProduct("Reprice Second Purchase", "5.00");
        invoiceService.close(purchase(line(product, "7.25")).getId(), user);

        invoiceService.close(purchase(line(product, "9.50")).getId(), user);

        assertThat(priceOf(product.getId())).isEqualByComparingTo("9.50");
        // exactly two rows, in order: the price walks 5.00 -> 7.25 -> 9.50, one row per closed invoice
        assertThat(priceLog(product.getId()))
                .extracting(row -> (String) row.get("old_value"), row -> (String) row.get("new_value"))
                .containsExactly(tuple("5.00", "7.25"), tuple("7.25", "9.50"));
    }
}
