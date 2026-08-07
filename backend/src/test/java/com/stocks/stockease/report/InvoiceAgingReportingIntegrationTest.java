package com.stocks.stockease.report;

import static com.stocks.stockease.report.ReportingTestFixtures.nextNumber;
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
import com.stocks.stockease.movement.StockMovementService;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;
import com.stocks.stockease.support.AbstractIntegrationTest;

/*
 * Contract: the three reports that chase money - due-date buckets, overdue, and due soon.
 *
 * All three answer about invoices rather than about stock, and all three turn on the same two
 * facts: an invoice is owed until it is marked paid, and its due date decides which report it
 * belongs in. Every case here therefore seeds a matching pair - one settled, one not - so a
 * passing test proves the report filtered rather than merely returned everything.
 *
 * These are the only reports that read unpaid invoices, which is why unpaidSale and
 * overduePurchase live here rather than in the shared fixtures.
 *
 * Every test commits (NOT_SUPPORTED), so names are per-test and invoice numbers come from the
 * one shared counter in ReportingTestFixtures.
 *
 * Out of scope: revenue, cost and profit (ProfitReportingIntegrationTest) and stock levels and
 * losses (StockStatusAndLossReportingIntegrationTest).
 */
@SpringBootTest
@ActiveProfiles("test")
class InvoiceAgingReportingIntegrationTest extends AbstractIntegrationTest {

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

    private Invoice unpaidSale(long productId, int qty, String unitPrice, LocalDate dueDate) {
        return invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.SALE, nextNumber(), null, null,
                dueDate, null, null,
                List.of(new CreateInvoiceCommand.ItemLine(productId, qty, new BigDecimal(unitPrice)))));
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
        Supplier supplier = supplierService.create("RPT Overdue Supplier", null, null, "1 Main St", null);
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
        assertThat(row.invoiceNumber()).isEqualTo(late.getInvoiceNumber());
    }

    /** A closed purchase invoice that fell due yesterday. */
    private Invoice overduePurchase(long supplierId, long productId) {
        Invoice invoice = invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.PURCHASE,
                nextNumber(), supplierId, null, LocalDate.now().minusDays(1), null, null,
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

        assertThat(rows).noneMatch(row -> row.invoiceId().equals(later.getId()));
        InvoiceDueSummary row = rows.stream()
                .filter(entry -> entry.invoiceId().equals(soon.getId())).findFirst().orElseThrow();
        assertThat(row.invoiceNumber()).isEqualTo(soon.getInvoiceNumber());
    }
}
