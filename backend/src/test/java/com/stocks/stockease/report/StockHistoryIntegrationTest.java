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
import com.stocks.stockease.movement.MovementReason;
import com.stocks.stockease.movement.MovementRemark;
import com.stocks.stockease.movement.RecordMovementCommand;
import com.stocks.stockease.movement.StockMovementService;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Tests the stock-history series against real movements built through the domain services.
 * Every method commits, so each names its own product and asserts on that product's history.
 */
@SpringBootTest
@ActiveProfiles("test")
class StockHistoryIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ReportingService reportingService;

    @Autowired
    private ProductService productService;

    @Autowired
    private SupplierService supplierService;

    @Autowired
    private InvoiceService invoiceService;

    @Autowired
    private StockMovementService stockMovementService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User user;

    @BeforeEach
    void setUp() {
        user = userRepository.findByUsername("history-tester")
                .orElseGet(() -> userRepository.saveAndFlush(new User("history-tester", "hash", "ROLE_ADMIN")));
    }

    private static final AtomicInteger NUMBERS = new AtomicInteger();

    private static String nextNumber() {
        return "TST-HIST-" + NUMBERS.incrementAndGet();
    }

    /**
     * Moves one reason's movement to a day in the past.
     *
     * <p>Movements are stamped as they are booked, so a multi-day history has to be arranged after
     * the fact - the same call the demo module makes for the same reason (ADR 027). Each fixture
     * books a given reason once, so the reason identifies the row.
     */
    private void bookedDaysAgo(Product product, MovementReason reason, int daysAgo) {
        jdbcTemplate.update("UPDATE stock_movement SET created_at = ? WHERE product_id = ? AND reason = ?",
                LocalDate.now().minusDays(daysAgo).atTime(12, 0), product.getId(), reason.name());
    }

    /**
     * Buys 40, sells 8, takes 2 back from the customer and loses 3, each on its own day.
     * Levels run 40, 32, 34, 31; sold units run 0, 8, 6, 6.
     */
    private Product scenario(String name) {
        Supplier supplier = supplierService.create(name + " Supplier", null, null, "1 Main St", null);
        Product product = productService.create(name, "HIST-" + name.hashCode(), 10.0);

        Invoice purchase = closedInvoice(InvoiceType.PURCHASE, supplier.getId(), product, 40, "10.00");
        bookedDaysAgo(product, MovementReason.PURCHASE, 20);

        Invoice sale = closedInvoice(InvoiceType.SALE, null, product, 8, "30.00");
        bookedDaysAgo(product, MovementReason.SOLD, 10);

        record(MovementReason.RETURN_FROM_CUSTOMER, product, 2, firstItemId(sale));
        bookedDaysAgo(product, MovementReason.RETURN_FROM_CUSTOMER, 5);

        record(MovementReason.LOST, product, 3, null);
        bookedDaysAgo(product, MovementReason.LOST, 2);

        assertThat(purchase.getId()).isNotNull();
        return product;
    }

    private Invoice closedInvoice(InvoiceType type, Long supplierId, Product product, int qty, String price) {
        Invoice invoice = invoiceService.createInvoice(new CreateInvoiceCommand(type, nextNumber(), supplierId,
                null, LocalDate.now(), null, null,
                List.of(new CreateInvoiceCommand.ItemLine(product.getId(), qty, new BigDecimal(price)))));
        invoiceService.close(invoice.getId(), user);
        return invoice;
    }

    private void record(MovementReason reason, Product product, int qty, Long itemId) {
        MovementRemark remark = reason == MovementReason.LOST ? MovementRemark.INTERNAL : null;
        stockMovementService.recordMovement(
                new RecordMovementCommand(product.getId(), reason, qty, itemId, null, remark), user);
    }

    private static Long firstItemId(Invoice invoice) {
        return invoice.getItems().get(0).getId();
    }

    private List<StockHistoryPoint> history(Product product, LocalDate from, LocalDate to) {
        return reportingService.stockHistory(product.getId(), from, to).orElseThrow();
    }

    @Test
    void stockHistory_movementsAcrossDays_runsSignedCumulative() {
        Product product = scenario("Hist Signed");

        List<StockHistoryPoint> points = history(product, null, null);

        // the running signed sum, one point per day that moved: +40, -8, +2, -3
        assertThat(points).extracting(StockHistoryPoint::stockLevel).containsExactly(40, 32, 34, 31);
        // sales net of customer returns, which is a different running total over the same days
        assertThat(points).extracting(StockHistoryPoint::cumulativeSoldUnits).containsExactly(0, 8, 6, 6);
    }

    @Test
    void stockHistory_finalPoint_equalsProductQuantity() {
        Product product = scenario("Hist Consistency");

        List<StockHistoryPoint> points = history(product, null, null);

        // the ledger-completeness guarantee of ADR 021, asserted rather than assumed: stock moves
        // only through booked movements, so summing them has to reproduce the live quantity
        int live = productService.findById(product.getId()).orElseThrow().getQuantity();
        assertThat(points.get(points.size() - 1).stockLevel()).isEqualTo(live);
    }

    @Test
    void stockHistory_windowNarrowsPoints_notTheRunningSum() {
        Product product = scenario("Hist Window");

        List<StockHistoryPoint> points = history(product, LocalDate.now().minusDays(6), LocalDate.now());

        // only the two most recent days come back, and the first of them already carries the level
        // the product had reached before the window opened - it does not restart at the day's +2
        assertThat(points).hasSize(2);
        assertThat(points.get(0).stockLevel()).isEqualTo(34);
        assertThat(points.get(0).cumulativeSoldUnits()).isEqualTo(6);
    }

    @Test
    void stockHistory_unknownProduct_isEmptyOptional() {
        assertThat(reportingService.stockHistory(-1L, null, null)).isEmpty();
    }

    @Test
    void stockHistory_productWithoutMovements_isEmptyListNotEmptyOptional() {
        Product product = productService.create("Hist Untouched", "HIST-UNTOUCHED", 10.0);

        // the distinction the controller turns into 200-with-nothing versus 404
        assertThat(reportingService.stockHistory(product.getId(), null, null)).contains(List.of());
    }
}
