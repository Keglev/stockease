package com.stocks.stockease.report;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

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
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Tests the payment-basis cash-flow aggregation against real data built through the domain services.
 * Every method commits, so each test names its own product and asserts on that product's row rather
 * than on the report as a whole, which also carries whatever other committing tests left behind.
 */
@SpringBootTest
@ActiveProfiles("test")
class CashFlowIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ReportingService reportingService;

    @Autowired
    private CustomerService customerService;

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
        user = userRepository.findByUsername("cashflow-tester")
                .orElseGet(() -> userRepository.saveAndFlush(new User("cashflow-tester", "hash", "ROLE_ADMIN")));
    }

    /** Numbers are unique among live invoices, and these tests commit, so each takes a fresh one. */
    private static final AtomicInteger NUMBERS = new AtomicInteger();

    private static String nextNumber() {
        return "TST-CF-" + NUMBERS.incrementAndGet();
    }

    /**
     * Creates a product and stocks it through a closed purchase, the way the application does. The
     * stocking purchase stays unpaid on purpose, so it contributes nothing to cash flow and each test
     * decides for itself what money moved.
     */
    private Product newProduct(String name, int quantity) {
        Product product = productService.create(name, "CF-" + name.hashCode(), 5.0);
        Supplier supplier = supplierService.create(name + " Supplier", "1 Main St");
        Invoice purchase = invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.PURCHASE,
                nextNumber(), supplier.getId(), null, LocalDate.now(), null, null,
                List.of(line(product, quantity, "5.00"))));
        invoiceService.close(purchase.getId(), user);
        return product;
    }

    private Invoice closedSale(Long customerId, CreateInvoiceCommand.ItemLine... lines) {
        Invoice invoice = invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.SALE, nextNumber(),
                null, customerId, LocalDate.now(), null, null, List.of(lines)));
        invoiceService.close(invoice.getId(), user);
        return invoice;
    }

    private Invoice closedPurchase(long supplierId, CreateInvoiceCommand.ItemLine... lines) {
        Invoice invoice = invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.PURCHASE, nextNumber(),
                supplierId, null, LocalDate.now(), null, null, List.of(lines)));
        invoiceService.close(invoice.getId(), user);
        return invoice;
    }

    private static CreateInvoiceCommand.ItemLine line(Product product, int quantity, String unitPrice) {
        return new CreateInvoiceCommand.ItemLine(product.getId(), quantity, new BigDecimal(unitPrice));
    }

    /** The report's row for one product, absent when that product moved no money in the window. */
    private Optional<CashFlowProductRow> rowFor(long productId, LocalDate from, LocalDate to) {
        return reportingService.cashFlow(from, to).products().stream()
                .filter(row -> row.productId() == productId).findFirst();
    }

    @Test
    void cashFlow_paidSaleInvoice_countsInflowNetOfReturns() {
        Customer customer = customerService.create("CF Sale Customer", null, null, null, null);
        Product product = newProduct("CF Sale Product", 10);
        Invoice sale = closedSale(customer.getId(), line(product, 5, "20.00"));
        invoiceService.registerReturn(sale.getItems().get(0).getId(), 1);
        invoiceService.markAsPaid(sale.getId());

        CashFlowProductRow row = rowFor(product.getId(), null, null).orElseThrow();

        // four of the five units stayed sold, so the money that stayed in is 4 x 20.00
        assertThat(row.inflow()).isEqualByComparingTo("80.00");
        assertThat(row.outflow()).isEqualByComparingTo("0.00");
        assertThat(row.net()).isEqualByComparingTo("80.00");
    }

    @Test
    void cashFlow_paidPurchaseWithSupplierReturn_reducesOutflow() {
        Product product = newProduct("CF Purchase Product", 4);
        Supplier supplier = supplierService.create("CF Purchase Supplier", "1 Main St");
        Invoice purchase = closedPurchase(supplier.getId(), line(product, 10, "7.00"));
        invoiceService.registerReturn(purchase.getItems().get(0).getId(), 2);
        invoiceService.markAsPaid(purchase.getId());

        CashFlowProductRow row = rowFor(product.getId(), null, null).orElseThrow();

        // two units went back, so only eight were paid for
        assertThat(row.outflow()).isEqualByComparingTo("56.00");
        assertThat(row.net()).isEqualByComparingTo("-56.00");
    }

    @Test
    void cashFlow_unpaidClosedInvoice_isInvisible() {
        Customer customer = customerService.create("CF Unpaid Customer", null, null, null, null);
        Product product = newProduct("CF Unpaid Product", 10);
        closedSale(customer.getId(), line(product, 5, "20.00"));

        // booked but not settled: on a payment basis nothing has moved yet, so the product has no row
        assertThat(rowFor(product.getId(), null, null)).isEmpty();
    }

    @Test
    void cashFlow_paymentDateOutsideWindow_isExcluded() {
        Customer customer = customerService.create("CF Window Customer", null, null, null, null);
        Product product = newProduct("CF Window Product", 10);
        Invoice sale = closedSale(customer.getId(), line(product, 5, "20.00"));
        invoiceService.markAsPaid(sale.getId());

        assertThat(rowFor(product.getId(), LocalDate.of(2020, 1, 1), LocalDate.of(2020, 12, 31))).isEmpty();
        assertThat(rowFor(product.getId(), LocalDate.now(), LocalDate.now())).isPresent();
    }

    @Test
    void cashFlow_totals_equalRowSums() {
        Customer customer = customerService.create("CF Totals Customer", null, null, null, null);
        Product product = newProduct("CF Totals Product", 10);
        Supplier supplier = supplierService.create("CF Totals Supplier", "1 Main St");
        invoiceService.markAsPaid(closedSale(customer.getId(), line(product, 4, "30.00")).getId());
        invoiceService.markAsPaid(closedPurchase(supplier.getId(), line(product, 6, "9.00")).getId());

        CashFlowReport report = reportingService.cashFlow(null, null);

        // the totals are derived from the rows, and this is the invariant that makes that sound
        assertThat(report.inflow()).isEqualByComparingTo(sumOf(report.products(), CashFlowProductRow::inflow));
        assertThat(report.outflow()).isEqualByComparingTo(sumOf(report.products(), CashFlowProductRow::outflow));
        assertThat(report.net()).isEqualByComparingTo(report.inflow().subtract(report.outflow()));
    }

    private static BigDecimal sumOf(List<CashFlowProductRow> rows,
            java.util.function.Function<CashFlowProductRow, BigDecimal> field) {
        return rows.stream().map(field).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Settles an invoice and dates the settlement, which {@code markAsPaid} always stamps as now.
     *
     * <p>Backdating in SQL rather than through a service is the same call the demo module makes for
     * the same reason (ADR 027): no business operation sets a payment date, and adding one so a test
     * can reach the past would put a test concern into a production signature.
     */
    private void paidOn(Invoice invoice, LocalDate date) {
        invoiceService.markAsPaid(invoice.getId());
        jdbcTemplate.update("UPDATE invoice SET paid_at = ? WHERE id = ?", date.atStartOfDay(), invoice.getId());
    }

    /**
     * The timeline over one year only.
     *
     * <p>These tests commit and share a database, so every one of them owns a distinct year: a window
     * is what makes the buckets provably this test's own rather than whatever else has been paid.
     */
    private List<CashFlowTimelineBucket> timelineOf(int year) {
        return reportingService.cashFlowTimeline(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
    }

    @Test
    void cashFlowTimeline_paidFlowsAcrossMonths_bucketsChronologically() {
        Customer customer = customerService.create("CF TL Spread Customer", null, null, null, null);
        Product product = newProduct("CF TL Spread Product", 40);
        Supplier supplier = supplierService.create("CF TL Spread Supplier", "1 Main St");
        // settled out of order, so the ordering asserted below is the query's and not the insert's
        paidOn(closedSale(customer.getId(), line(product, 5, "20.00")), LocalDate.of(2019, 4, 15));
        paidOn(closedPurchase(supplier.getId(), line(product, 6, "9.00")), LocalDate.of(2019, 2, 10));

        List<CashFlowTimelineBucket> months = timelineOf(2019);

        assertThat(months).extracting(CashFlowTimelineBucket::month).containsExactly("2019-02", "2019-04");
        assertThat(months.get(0).outflow()).isEqualByComparingTo("54.00");
        assertThat(months.get(1).inflow()).isEqualByComparingTo("100.00");
        // March moved no money and is absent rather than zero-filled
        assertThat(months).hasSize(2);
    }

    @Test
    void cashFlowTimeline_windowExcludesMonth_omitsBucket() {
        Customer customer = customerService.create("CF TL Window Customer", null, null, null, null);
        Product product = newProduct("CF TL Window Product", 40);
        paidOn(closedSale(customer.getId(), line(product, 5, "20.00")), LocalDate.of(2018, 3, 9));
        paidOn(closedSale(customer.getId(), line(product, 4, "20.00")), LocalDate.of(2018, 8, 9));

        List<CashFlowTimelineBucket> narrowed = reportingService.cashFlowTimeline(
                LocalDate.of(2018, 8, 1), LocalDate.of(2018, 8, 31));

        assertThat(timelineOf(2018)).extracting(CashFlowTimelineBucket::month).containsExactly("2018-03", "2018-08");
        assertThat(narrowed).extracting(CashFlowTimelineBucket::month).containsExactly("2018-08");
        assertThat(narrowed.get(0).inflow()).isEqualByComparingTo("80.00");
    }

    @Test
    void cashFlowTimeline_monthWithOnlyOutflow_negativeNet() {
        Product product = newProduct("CF TL Outflow Product", 40);
        Supplier supplier = supplierService.create("CF TL Outflow Supplier", "1 Main St");
        paidOn(closedPurchase(supplier.getId(), line(product, 7, "12.00")), LocalDate.of(2017, 6, 20));

        List<CashFlowTimelineBucket> months = timelineOf(2017);

        assertThat(months).hasSize(1);
        assertThat(months.get(0).inflow()).isEqualByComparingTo("0.00");
        assertThat(months.get(0).outflow()).isEqualByComparingTo("84.00");
        // a month that only spent is the case the net sign exists to show
        assertThat(months.get(0).net()).isEqualByComparingTo("-84.00");
    }

    @Test
    void cashFlow_deletedProductWithPaidFlow_staysListedFlagged() {
        Customer customer = customerService.create("CF Deleted Customer", null, null, null, null);
        Product product = newProduct("CF Deleted Product", 10);
        invoiceService.markAsPaid(closedSale(customer.getId(), line(product, 5, "20.00")).getId());
        productService.deleteById(product.getId(), user);

        CashFlowProductRow row = rowFor(product.getId(), null, null).orElseThrow();

        // the money moved before the product was retired, and that stays true afterwards
        assertThat(row.deleted()).isTrue();
        assertThat(row.inflow()).isEqualByComparingTo("100.00");
    }
}
