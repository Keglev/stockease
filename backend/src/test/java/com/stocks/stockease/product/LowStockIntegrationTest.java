package com.stocks.stockease.product;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceItem;
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.invoice.internal.InvoiceItemRepository;
import com.stocks.stockease.invoice.internal.InvoiceRepository;
import com.stocks.stockease.movement.MovementReason;
import com.stocks.stockease.movement.RecordMovementCommand;
import com.stocks.stockease.movement.StockMovementService;
import com.stocks.stockease.product.internal.ProductRepository;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.internal.SupplierRepository;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Tests that the low-stock query scopes to products that have ever held stock (ADR 026), exercising the
 * real chain: creation leaves a product unflagged, and only booking a purchase brings it into scope.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class LowStockIntegrationTest extends AbstractIntegrationTest {

    private static final int THRESHOLD = 5;

    @Autowired
    private ProductService productService;

    @Autowired
    private StockMovementService stockMovementService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceItemRepository invoiceItemRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    private User user;

    @BeforeEach
    void setUp() {
        user = userRepository.findByUsername("low-stock-tester")
                .orElseGet(() -> userRepository.saveAndFlush(new User("low-stock-tester", "hash", "ROLE_ADMIN")));
    }

    /** invoice_number is NOT NULL and unique among live rows, so every fixture takes a fresh one. */
    private static final AtomicInteger NUMBERS = new AtomicInteger();

    private static String nextNumber() {
        return "TST-LOW-INV-" + NUMBERS.incrementAndGet();
    }

    private InvoiceItem itemFor(Product product, InvoiceType type, int quantity) {
        Invoice invoice = new Invoice();
        invoice.setInvoiceNumber(nextNumber());
        invoice.setType(type);
        if (type == InvoiceType.PURCHASE) {
            invoice.setSupplier(supplierRepository.saveAndFlush(new Supplier(null, "Acme", "1 Main St", null, null)));
        }
        // movements are rejected against open invoices, so the fixture stands in for an already-booked one
        invoice.setStatus(InvoiceStatus.CLOSED);
        invoice.setDueDate(LocalDate.now());
        invoice.setInterestRate(BigDecimal.ZERO);
        invoice.setFineValue(BigDecimal.ZERO);
        invoice = invoiceRepository.saveAndFlush(invoice);

        InvoiceItem item = new InvoiceItem();
        item.setInvoice(invoice);
        item.setProduct(product);
        item.setProductName(product.getName());
        item.setProductId(product.getId());
        item.setQuantity(quantity);
        item.setUnitPrice(new BigDecimal("15.00"));
        item.setReturnedQty(0);
        return invoiceItemRepository.saveAndFlush(item);
    }

    /** Books {@code quantity} units onto the product the only way stock enters: a purchase (ADR 021). */
    private void purchase(Product product, int quantity) {
        InvoiceItem item = itemFor(product, InvoiceType.PURCHASE, quantity);
        stockMovementService.recordMovement(new RecordMovementCommand(
                product.getId(), MovementReason.PURCHASE, quantity, item.getId(), null), user);
    }

    private void sell(Product product, int quantity) {
        InvoiceItem item = itemFor(product, InvoiceType.SALE, quantity);
        stockMovementService.recordMovement(new RecordMovementCommand(
                product.getId(), MovementReason.SOLD, quantity, item.getId(), null), user);
    }

    private Product reload(Product product) {
        return productRepository.findById(product.getId()).orElseThrow();
    }

    @Test
    void lowStock_neverPurchasedProductAtZero_isExcluded() {
        // exactly what creation produces: master data at zero stock (ADR 018), which the old
        // quantity-only query reported as low on the day the product was created
        Product product = productService.create("Low Stock Never Purchased", "TST-LOW-1", 12.0);

        assertThat(product.getQuantity()).isZero();
        assertThat(productService.findLowStock(THRESHOLD)).doesNotContain(reload(product));
    }

    @Test
    void lowStock_purchasedThenSoldToZero_isIncluded() {
        Product product = productService.create("Low Stock Sold To Zero", "TST-LOW-2", 12.0);
        purchase(product, 8);
        sell(product, 8);

        // same zero quantity as the product above, opposite verdict: this one is the alert's whole point
        assertThat(reload(product).getQuantity()).isZero();
        assertThat(productService.findLowStock(THRESHOLD)).contains(reload(product));
    }

    @Test
    void lowStock_purchasedProductAboveThreshold_isExcluded() {
        // the ever-stocked predicate narrows the old one rather than replacing it: being stocked is not
        // by itself grounds for an alert
        Product product = productService.create("Low Stock Well Stocked", "TST-LOW-3", 12.0);
        purchase(product, 20);

        assertThat(reload(product).isEverStocked()).isTrue();
        assertThat(productService.findLowStock(THRESHOLD)).doesNotContain(reload(product));
    }
}
