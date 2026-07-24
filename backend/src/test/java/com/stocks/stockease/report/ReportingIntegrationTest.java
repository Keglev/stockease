package com.stocks.stockease.report;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.invoice.CreateInvoiceCommand;
import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.movement.MovementReason;
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
 * Tests the reporting read model against real data built through the domain services.
 * Every method commits, so product names are unique per test and the shared user is reused.
 */
@SpringBootTest
@ActiveProfiles("test")
class ReportingIntegrationTest extends AbstractIntegrationTest {

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

    private User user;

    @BeforeEach
    void setUp() {
        user = userRepository.findByUsername("report-tester")
                .orElseGet(() -> userRepository.saveAndFlush(new User("report-tester", "hash", "ROLE_ADMIN")));
    }

    /** Products start at quantity 0 so all stock exists only via movements the reports read. */
    private Product newProduct(String name, String purchasePrice) {
        return productService.create(name, 0, new BigDecimal(purchasePrice).doubleValue());
    }

    private Invoice closedPurchase(long supplierId, long productId, int qty, String unitPrice) {
        Invoice invoice = invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.PURCHASE, supplierId,
                null, LocalDate.now(), null, null,
                List.of(new CreateInvoiceCommand.ItemLine(productId, qty, new BigDecimal(unitPrice)))));
        invoiceService.close(invoice.getId(), user);
        return invoice;
    }

    private Invoice closedSale(long productId, int qty, String unitPrice) {
        Invoice invoice = invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.SALE, null, null,
                LocalDate.now(), null, null,
                List.of(new CreateInvoiceCommand.ItemLine(productId, qty, new BigDecimal(unitPrice)))));
        invoiceService.close(invoice.getId(), user);
        return invoice;
    }

    private Invoice unpaidSale(long productId, int qty, String unitPrice, LocalDate dueDate) {
        return invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.SALE, null, null, dueDate,
                null, null,
                List.of(new CreateInvoiceCommand.ItemLine(productId, qty, new BigDecimal(unitPrice)))));
    }

    private static Long firstItemId(Invoice invoice) {
        return invoice.getItems().get(0).getId();
    }

    private void record(MovementReason reason, long productId, int qty, Long itemId) {
        stockMovementService.recordMovement(new RecordMovementCommand(productId, reason, qty, itemId, null), user);
    }

    /** Product id and supplier id of one full purchase-sale-return-loss scenario. */
    private record Scenario(long productId, long supplierId) {
    }

    /**
     * Builds scenario A: buy 10 at 10.00, sell 4 at 30.00, take 1 back from the customer,
     * return 2 to the supplier and lose 1.
     */
    private Scenario scenarioA(String productName) {
        Supplier supplier = supplierService.create(productName + " Supplier", "1 Main St");
        Product product = newProduct(productName, "10.00");
        Invoice purchase = closedPurchase(supplier.getId(), product.getId(), 10, "10.00");
        Invoice sale = closedSale(product.getId(), 4, "30.00");
        record(MovementReason.RETURN_FROM_CUSTOMER, product.getId(), 1, firstItemId(sale));
        record(MovementReason.RETURNED_TO_SUPPLIER, product.getId(), 2, firstItemId(purchase));
        record(MovementReason.LOST, product.getId(), 1, null);
        return new Scenario(product.getId(), supplier.getId());
    }

    private ProductProfitReport profitRow(long productId) {
        return reportingService.profitPerProduct().stream()
                .filter(row -> row.productId() == productId).findFirst().orElseThrow();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void profitPerProduct_mixedFlows_computesRevenueCostAndProfit() {
        Scenario scenario = scenarioA("RPT Alpha Profit");

        ProductProfitReport row = profitRow(scenario.productId());

        assertThat(row.revenue()).isEqualByComparingTo("90.00");
        assertThat(row.cost()).isEqualByComparingTo("80.00");
        assertThat(row.grossProfit()).isEqualByComparingTo("10.00");
        assertThat(row.deleted()).isFalse();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void profitForProduct_soldBelowCost_reportsNegativeProfit() {
        Supplier supplier = supplierService.create("RPT Beta Supplier", "1 Main St");
        Product product = newProduct("RPT Beta Loss Making", "20.00");
        closedPurchase(supplier.getId(), product.getId(), 5, "20.00");
        closedSale(product.getId(), 5, "15.00");

        ProductProfitReport row = reportingService.profitForProduct(product.getId()).orElseThrow();

        assertThat(row.revenue()).isEqualByComparingTo("75.00");
        assertThat(row.cost()).isEqualByComparingTo("100.00");
        assertThat(row.grossProfit()).isEqualByComparingTo("-25.00");
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void profitPerProduct_softDeletedProduct_stillListed() {
        Supplier supplier = supplierService.create("RPT Gamma Supplier", "1 Main St");
        Product product = newProduct("RPT Gamma Deleted", "10.00");
        closedPurchase(supplier.getId(), product.getId(), 3, "10.00");
        productService.deleteById(product.getId(), user);

        ProductProfitReport row = profitRow(product.getId());

        assertThat(row.deleted()).isTrue();
        assertThat(row.cost()).isEqualByComparingTo("30.00");
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void profitPerSupplier_aggregatesSuppliedProducts() {
        Scenario scenario = scenarioA("RPT Alpha Supplier View");

        SupplierProfitReport row = reportingService.profitPerSupplier().stream()
                .filter(entry -> entry.supplierId() == scenario.supplierId()).findFirst().orElseThrow();

        assertThat(row.revenue()).isEqualByComparingTo("90.00");
        assertThat(row.cost()).isEqualByComparingTo("80.00");
        assertThat(row.grossProfit()).isEqualByComparingTo("10.00");
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void profitPerSupplier_productFromTwoSuppliers_countsFullyForEach() {
        Supplier first = supplierService.create("RPT Shared Supplier X", "1 Main St");
        Supplier second = supplierService.create("RPT Shared Supplier Y", "2 Side St");
        Product product = newProduct("RPT Shared Two Suppliers", "10.00");
        closedPurchase(first.getId(), product.getId(), 5, "10.00");
        closedPurchase(second.getId(), product.getId(), 5, "12.00");
        closedSale(product.getId(), 4, "30.00");

        List<SupplierProfitReport> rows = reportingService.profitPerSupplier();

        // pins the intended double-counting: a product bought from several suppliers counts fully for
        // each. Changing this to per-supplier cost allocation would be a design change requiring an ADR
        // update, not a bug fix.
        assertFullAttribution(rows, first.getId());
        assertFullAttribution(rows, second.getId());
    }

    /** Asserts the supplier carries the shared product's whole revenue, cost and gross profit. */
    private static void assertFullAttribution(List<SupplierProfitReport> rows, Long supplierId) {
        SupplierProfitReport row = rows.stream()
                .filter(entry -> entry.supplierId().equals(supplierId)).findFirst().orElseThrow();
        assertThat(row.revenue()).isEqualByComparingTo("120.00");
        assertThat(row.cost()).isEqualByComparingTo("110.00");
        assertThat(row.grossProfit()).isEqualByComparingTo("10.00");
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

        LossReport row = reportingService.lossReport().stream()
                .filter(entry -> entry.productId() == scenario.productId()).findFirst().orElseThrow();

        assertThat(row.lostUnits()).isEqualTo(1);
        assertThat(row.destroyedUnits()).isEqualTo(0);
        assertThat(row.lossValue()).isEqualByComparingTo("10.00");
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void dueDateBuckets_groupsUnpaidByDateAndType() {
        LocalDate dueDate = LocalDate.now().plusDays(500);
        Product product = newProduct("RPT Bucket Widget", "10.00");
        unpaidSale(product.getId(), 2, "10.00", dueDate);
        unpaidSale(product.getId(), 3, "10.00", dueDate);
        Invoice paid = unpaidSale(product.getId(), 4, "10.00", dueDate);
        invoiceService.markAsPaid(paid.getId());

        DueDateBucket bucket = reportingService.dueDateBuckets().stream()
                .filter(entry -> entry.dueDate().equals(dueDate)).findFirst().orElseThrow();

        assertThat(bucket.invoiceType()).isEqualTo("SALE");
        assertThat(bucket.invoiceCount()).isEqualTo(2);
        assertThat(bucket.totalValue()).isEqualByComparingTo("50.00");
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void overdue_closedUnpaidPastDue_listedWithDaysOverdue() {
        Supplier supplier = supplierService.create("RPT Overdue Supplier", "1 Main St");
        Product product = newProduct("RPT Overdue Widget", "10.00");
        Invoice late = overduePurchase(supplier.getId(), product.getId());
        Invoice settled = overduePurchase(supplier.getId(), product.getId());
        invoiceService.markAsPaid(settled.getId());

        List<InvoiceDueSummary> rows = reportingService.overdue();

        assertThat(rows).noneMatch(row -> row.invoiceId().equals(settled.getId()));
        InvoiceDueSummary row = rows.stream()
                .filter(entry -> entry.invoiceId().equals(late.getId())).findFirst().orElseThrow();
        assertThat(row.daysOverdue()).isEqualTo(1L);
        assertThat(row.counterparty()).isEqualTo("RPT Overdue Supplier");
    }

    /** A closed purchase invoice that fell due yesterday. */
    private Invoice overduePurchase(long supplierId, long productId) {
        Invoice invoice = invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.PURCHASE, supplierId,
                null, LocalDate.now().minusDays(1), null, null,
                List.of(new CreateInvoiceCommand.ItemLine(productId, 1, new BigDecimal("10.00")))));
        invoiceService.close(invoice.getId(), user);
        return invoice;
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void dueSoon_windowFiltersByDueDate() {
        Product product = newProduct("RPT Due Soon Widget", "10.00");
        Invoice soon = unpaidSale(product.getId(), 1, "10.00", LocalDate.now().plusDays(3));
        Invoice later = unpaidSale(product.getId(), 1, "10.00", LocalDate.now().plusDays(30));

        List<InvoiceDueSummary> rows = reportingService.dueSoon(7);

        assertThat(rows).anyMatch(row -> row.invoiceId().equals(soon.getId()));
        assertThat(rows).noneMatch(row -> row.invoiceId().equals(later.getId()));
    }
}
