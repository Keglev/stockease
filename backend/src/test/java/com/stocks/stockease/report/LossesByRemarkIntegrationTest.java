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
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.invoice.CreateInvoiceCommand;
import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.movement.MovementReason;
import com.stocks.stockease.movement.MovementRemark;
import com.stocks.stockease.movement.RecordMovementCommand;
import com.stocks.stockease.movement.StockMovement;
import com.stocks.stockease.movement.StockMovementService;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Tests the per-remark loss breakdown against a real database. The query is native SQL, so a slice
 * test would exercise none of it - the #140 rule: what only the database can answer, only an
 * integration test can check.
 *
 * <p><b>Why every scenario lives in its own historical year.</b> Unlike the per-product report,
 * this one aggregates across every product, so a caller cannot filter the result down to its own
 * fixture the way the sibling tests filter by product id. The suite shares one database and several
 * other classes book write-offs of their own, which makes a query over "all time" or "today"
 * nondeterministic by construction - and these methods commit, so they would also see each other.
 *
 * <p>Each scenario therefore backdates its movements into a year of its own, decades before
 * anything else the suite writes: the demo seed's two write-offs sit 55 and 33 days back, and no
 * other test reaches further. Inside such a window the totals are exactly the four write-offs that
 * scenario booked, which is what lets them be pinned whole rather than asserted as "at least".
 */
@SpringBootTest
@ActiveProfiles("test")
class LossesByRemarkIntegrationTest extends AbstractIntegrationTest {

    @Autowired private StockReportingService reportingService;
    @Autowired private ProductService productService;
    @Autowired private SupplierService supplierService;
    @Autowired private InvoiceService invoiceService;
    @Autowired private StockMovementService stockMovementService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    /** Names and SKUs are unique across the committing suite, so each fixture takes a fresh token. */
    private static final AtomicInteger N = new AtomicInteger();

    /** One year per scenario, counted separately so the year does not depend on fixture churn. */
    private static final AtomicInteger YEARS = new AtomicInteger();

    /**
     * Each scenario's own isolated year, and the two days inside it that the write-offs land on.
     *
     * <p>A year per scenario, not one shared by the class: these methods commit, so a shared window
     * would let each run see the ones before it and the totals would climb with every test.
     */
    private record Window(int year) {
        LocalDate start() {
            return LocalDate.of(year, 1, 1);
        }

        LocalDate end() {
            return LocalDate.of(year, 12, 31);
        }

        LocalDate marchDay() {
            return LocalDate.of(year, 3, 10);
        }

        LocalDate juneDay() {
            return LocalDate.of(year, 6, 10);
        }
    }

    private User user;

    @BeforeEach
    void setUp() {
        user = userRepository.findByUsername("remark-tester")
                .orElseGet(() -> userRepository.saveAndFlush(new User("remark-tester", "hash", "ROLE_ADMIN")));
    }

    private String tag() {
        return "BRK-" + N.incrementAndGet();
    }

    /** A product stocked with {@code qty} units through a closed purchase, so it has stock to lose. */
    private Product stockedProduct(String purchasePrice, int qty) {
        String tag = tag();
        Product product = productService.create("Remark " + tag, tag, new BigDecimal(purchasePrice).doubleValue());
        Supplier supplier = supplierService.create("Remark Supplier " + tag, null, null, "1 Main St", null);
        Invoice purchase = invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.PURCHASE, tag,
                supplier.getId(), null, LocalDate.now(), null, null,
                List.of(new CreateInvoiceCommand.ItemLine(product.getId(), qty, new BigDecimal(purchasePrice)))));
        invoiceService.close(purchase.getId(), user);
        return product;
    }

    private StockMovement writeOff(Product product, MovementReason reason, int qty, MovementRemark remark) {
        return stockMovementService.recordMovement(
                new RecordMovementCommand(product.getId(), reason, qty, null, null, remark), user);
    }

    /**
     * Moves a booked write-off into the isolated window. The column is set by JPA auditing on
     * insert, so a test that needs a movement to have happened in the past has to say so directly -
     * the same JDBC surgery ChangesListingIntegrationTest uses, and the same one the demo's own
     * temporal spread performs in production code.
     */
    private void backdate(StockMovement movement, LocalDate when) {
        jdbcTemplate.update("UPDATE stock_movement SET created_at = ? WHERE id = ?",
                when.atStartOfDay(), movement.getId());
    }

    private List<LossByRemark> breakdown(LocalDate from, LocalDate to) {
        return reportingService.lossesByRemark(from, to);
    }

    private static LossByRemark rowFor(List<LossByRemark> rows, MovementRemark remark) {
        return rows.stream().filter(row -> row.remark().equals(remark.name())).findFirst().orElseThrow();
    }

    /**
     * Books four write-offs whose arithmetic is traced in the assertions that read them:
     *
     * <ul>
     *   <li>3 units of a 10.00 product LOST, in transit to the customer, dated in March</li>
     *   <li>2 units of a 4.00 product DESTROYED, expired, dated in June</li>
     *   <li>1 unit of that same 4.00 product LOST, also expired, dated in June</li>
     *   <li>1 unit of the 10.00 product DESTROYED, also expired, dated in June</li>
     * </ul>
     *
     * <p>The last three share a remark across both write-off reasons, which is the grouping ADR
     * 020's shared taxonomy exists to make meaningful. They also span two purchase prices on
     * purpose: a remark's value has to be summed per movement, and a scenario where every row in a
     * group costs the same would pass just as well against a query that priced the group once.
     */
    private Window bookScenario() {
        Window window = new Window(2000 + YEARS.incrementAndGet());
        Product dear = stockedProduct("10.00", 10);
        Product cheap = stockedProduct("4.00", 10);

        backdate(writeOff(dear, MovementReason.LOST, 3, MovementRemark.IN_TRANSIT_TO_CUSTOMER), window.marchDay());
        backdate(writeOff(cheap, MovementReason.DESTROYED, 2, MovementRemark.EXPIRED), window.juneDay());
        backdate(writeOff(cheap, MovementReason.LOST, 1, MovementRemark.EXPIRED), window.juneDay());
        backdate(writeOff(dear, MovementReason.DESTROYED, 1, MovementRemark.EXPIRED), window.juneDay());
        return window;
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void lossesByRemark_windowWithWriteOffs_groupsUnitsAndValuePerRemark() {
        Window window = bookScenario();

        List<LossByRemark> rows = breakdown(window.start(), window.end());

        // Ordered by remark, so the pair is asserted in the order the endpoint returns it.
        assertThat(rows).extracting(LossByRemark::remark)
                .containsExactly("EXPIRED", "IN_TRANSIT_TO_CUSTOMER");

        // EXPIRED spans both prices, so its value is summed per movement rather than per group:
        //   2 destroyed x 4.00  =  8.00
        //   1 lost      x 4.00  =  4.00
        //   1 destroyed x 10.00 = 10.00
        //                        ------
        //                         22.00   over 1 lost and 3 destroyed units
        LossByRemark expired = rowFor(rows, MovementRemark.EXPIRED);
        assertThat(expired.lostUnits()).isEqualTo(1);
        assertThat(expired.destroyedUnits()).isEqualTo(3);
        assertThat(expired.lossValue()).isEqualByComparingTo("22.00");

        // IN_TRANSIT_TO_CUSTOMER: 3 lost of the 10.00 product = 30.00, nothing destroyed
        LossByRemark inTransit = rowFor(rows, MovementRemark.IN_TRANSIT_TO_CUSTOMER);
        assertThat(inTransit.lostUnits()).isEqualTo(3);
        assertThat(inTransit.destroyedUnits()).isEqualTo(0);
        assertThat(inTransit.lossValue()).isEqualByComparingTo("30.00");
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void lossesByRemark_remarksWithNoLossesInWindow_areAbsentRatherThanZeroed() {
        Window window = bookScenario();

        List<LossByRemark> rows = breakdown(window.start(), window.end());

        // The per-product report's contract, continued: a losses report lists losses. INTERNAL and
        // FROM_SUPPLIER exist in the taxonomy and had none here, so they have no row - a zero row
        // would claim they were considered and found empty, which is a different statement.
        assertThat(rows).extracting(LossByRemark::remark)
                .doesNotContain("INTERNAL", "FROM_SUPPLIER");
        assertThat(rows).allSatisfy(row -> assertThat(row.lossValue()).isNotNull());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void lossesByRemark_windowExcludingOneMovement_dropsItFromTheTotals() {
        Window window = bookScenario();

        // March only: the June pair falls outside, so the remark they carry disappears entirely
        // rather than reporting a smaller number.
        List<LossByRemark> march = breakdown(window.marchDay().withDayOfMonth(1), window.marchDay().withDayOfMonth(31));

        assertThat(march).extracting(LossByRemark::remark).containsExactly("IN_TRANSIT_TO_CUSTOMER");
        assertThat(rowFor(march, MovementRemark.IN_TRANSIT_TO_CUSTOMER).lossValue())
                .isEqualByComparingTo("30.00");

        // The mirror image: a window holding only the June pair sees them and not the March one.
        List<LossByRemark> june = breakdown(window.juneDay().withDayOfMonth(1), window.juneDay().withDayOfMonth(30));

        assertThat(june).extracting(LossByRemark::remark).containsExactly("EXPIRED");
        assertThat(rowFor(june, MovementRemark.EXPIRED).lossValue()).isEqualByComparingTo("22.00");
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void lossesByRemark_windowWithoutAnyWriteOffs_isEmpty() {
        bookScenario();

        // 1990 sits below every scenario year, so this window holds nothing at all - not this
        // method's write-offs, not another method's. Empty list, not a list of zeroed remarks.
        assertThat(breakdown(LocalDate.of(1990, 1, 1), LocalDate.of(1990, 12, 31))).isEmpty();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void lossesByRemark_boundaryDates_areInclusiveAtBothEnds() {
        Window window = bookScenario();

        // from and to name days, not instants: a movement booked on the last day of the window is
        // inside it, which is what the query's "< to + 1 day" is for.
        assertThat(breakdown(window.marchDay(), window.marchDay())).extracting(LossByRemark::remark)
                .containsExactly("IN_TRANSIT_TO_CUSTOMER");
    }
}
