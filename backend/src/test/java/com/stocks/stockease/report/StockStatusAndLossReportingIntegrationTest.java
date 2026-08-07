package com.stocks.stockease.report;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.movement.StockMovementService;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.report.ReportingTestFixtures.Scenario;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.supplier.SupplierService;
import com.stocks.stockease.support.AbstractIntegrationTest;

/*
 * Contract: what is on the shelf and what never made it there - the stock-status report and the
 * loss report.
 *
 * The two are specified together because they answer the same question from opposite ends, and
 * their join strategies differ on purpose. Stock status LEFT JOINs and lists every live product,
 * excluding only the soft-deleted. The loss report INNER JOINs and lists only products that
 * actually lost something, so a product with no losses in a window drops out rather than
 * appearing as a zero - a zero would claim the product was checked and found intact.
 *
 * Every test commits (NOT_SUPPORTED), so names are per-test and invoice numbers come from the
 * one shared counter in ReportingTestFixtures.
 *
 * Out of scope: revenue, cost and profit (ProfitReportingIntegrationTest) and the unpaid-invoice
 * reports (InvoiceAgingReportingIntegrationTest).
 */
@SpringBootTest
@ActiveProfiles("test")
class StockStatusAndLossReportingIntegrationTest extends AbstractIntegrationTest {

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

    private ReportingTestFixtures fixtures;
    private User user;

    @BeforeEach
    void setUp() {
        fixtures = new ReportingTestFixtures(productService, supplierService, invoiceService,
                stockMovementService, userRepository);
        user = fixtures.user;
    }

    private Product newProduct(String name, String purchasePrice) {
        return fixtures.newProduct(name, purchasePrice);
    }

    private Scenario scenarioA(String productName) {
        return fixtures.scenarioA(productName);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void stockStatus_excludesSoftDeletedProducts() {
        Scenario scenario = scenarioA("RPT Alpha Stock View");
        Product deleted = newProduct("RPT Stock Deleted", "10.00");
        productService.deleteById(deleted.getId(), user);

        List<StockStatusReport> rows = reportingService.stockStatus();

        assertThat(rows).noneMatch(row -> row.productId().equals(deleted.getId()));
        StockStatusReport row = rows.stream()
                .filter(entry -> entry.productId() == scenario.productId()).findFirst().orElseThrow();
        assertThat(row.soldUnits()).isEqualTo(3);
        assertThat(row.soldRevenue()).isEqualByComparingTo("90.00");
        assertThat(row.inStockUnits()).isEqualTo(4);
        assertThat(row.inStockValue()).isEqualByComparingTo("40.00");
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void lossReport_lostUnits_valuedAtCurrentPurchasePrice() {
        Scenario scenario = scenarioA("RPT Alpha Loss View");

        LossReport row = lossRow(scenario.productId(), null, null).orElseThrow();

        assertThat(row.lostUnits()).isEqualTo(1);
        assertThat(row.destroyedUnits()).isEqualTo(0);
        assertThat(row.lossValue()).isEqualByComparingTo("10.00");
    }

    /** One product's loss row over an optional window, absent when it lost nothing in range. */
    private Optional<LossReport> lossRow(long productId, LocalDate from, LocalDate to) {
        return reportingService.lossReport(from, to).stream()
                .filter(entry -> entry.productId() == productId).findFirst();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void losses_fromToWindow_excludesMovementsOutsideRange() {
        Scenario scenario = scenarioA("RPT Loss Window");
        LocalDate today = LocalDate.now();

        assertThat(lossRow(scenario.productId(), today, today).orElseThrow().lostUnits()).isEqualTo(1);
        assertThat(lossRow(scenario.productId(), LocalDate.of(2020, 1, 1), LocalDate.of(2020, 12, 31)))
                .isEmpty();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void losses_windowWithoutLossesForAProduct_dropsItRatherThanZeroingIt() {
        Scenario scenario = scenarioA("RPT Loss Drop");

        List<LossReport> outOfRange = reportingService.lossReport(
                LocalDate.of(2020, 1, 1), LocalDate.of(2020, 12, 31));

        // The opposite of the profit report, and deliberately: that one LEFT JOINs so every product
        // is listed, while this one INNER JOINs and already lists only products that lost something.
        // A product with no losses in the window has nothing to report, exactly as one that never
        // lost anything has nothing to report.
        assertThat(outOfRange).noneMatch(row -> row.productId() == scenario.productId());
        assertThat(outOfRange).allSatisfy(row -> assertThat(row.lossValue()).isNotNull());
    }
}
