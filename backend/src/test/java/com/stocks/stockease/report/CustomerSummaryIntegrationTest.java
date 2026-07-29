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
 * Tests the customer summary aggregation against real data built through the domain services.
 * Every method commits, so customer and product names are unique per test and the shared user is reused.
 */
@SpringBootTest
@ActiveProfiles("test")
class CustomerSummaryIntegrationTest extends AbstractIntegrationTest {

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

    private User user;

    @BeforeEach
    void setUp() {
        user = userRepository.findByUsername("summary-tester")
                .orElseGet(() -> userRepository.saveAndFlush(new User("summary-tester", "hash", "ROLE_ADMIN")));
    }

    private Customer newCustomer(String name) {
        return customerService.create(name, null, null, null, null);
    }

    /**
     * Stocked up front so closing a sale has units to book out. Creation itself books no stock
     * (ADR 018) and stock now enters only through a closed purchase invoice (ADR 021), so the
     * fixture buys the units the way the application does.
     */
    private Product newProduct(String name, int quantity) {
        Product product = productService.create(name, "SUM-" + name.hashCode(), 5.0);
        Supplier supplier = supplierService.create(name + " Supplier", "1 Main St");
        Invoice purchase = invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.PURCHASE,
                nextNumber(), supplier.getId(), null, LocalDate.now(), null, null,
                List.of(line(product, quantity, "5.00"))));
        invoiceService.close(purchase.getId(), user);
        return product;
    }

    /** Numbers are unique among live invoices, and these tests commit, so each takes a fresh one. */
    private static final AtomicInteger NUMBERS = new AtomicInteger();

    private static String nextNumber() {
        return "TST-SUM-" + NUMBERS.incrementAndGet();
    }

    private Invoice sale(Long customerId, CreateInvoiceCommand.ItemLine... lines) {
        return invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.SALE, nextNumber(), null,
                customerId, LocalDate.now(), null, null, List.of(lines)));
    }

    private static CreateInvoiceCommand.ItemLine line(Product product, int quantity, String unitPrice) {
        return new CreateInvoiceCommand.ItemLine(product.getId(), quantity, new BigDecimal(unitPrice));
    }

    @Test
    void customerSummary_withClosedSaleAndPartialReturn_reportsExactFigures() {
        Customer customer = newCustomer("Summary Closed Sale");
        Product first = newProduct("Summary Closed A", 10);
        Product second = newProduct("Summary Closed B", 10);
        Invoice invoice = sale(customer.getId(), line(first, 3, "10.00"), line(second, 2, "25.00"));
        invoiceService.close(invoice.getId(), user);
        invoiceService.registerReturn(invoice.getItems().get(0).getId(), 1);

        CustomerSummary summary = reportingService.customerSummary(customer.getId()).orElseThrow();

        assertThat(summary.name()).isEqualTo("Summary Closed Sale");
        assertThat(summary.deleted()).isFalse();
        assertThat(summary.saleInvoiceCount()).isEqualTo(1);
        assertThat(summary.boughtUnits()).isEqualTo(5);
        assertThat(summary.boughtValue()).isEqualByComparingTo("80.00");
        assertThat(summary.returnedUnits()).isEqualTo(1);
        assertThat(summary.returnedValue()).isEqualByComparingTo("10.00");
    }

    @Test
    void customerSummary_withOnlyOpenSale_reportsZeros() {
        Customer customer = newCustomer("Summary Open Only");
        Product product = newProduct("Summary Open A", 10);
        sale(customer.getId(), line(product, 4, "12.00"));

        CustomerSummary summary = reportingService.customerSummary(customer.getId()).orElseThrow();

        // recorded but not yet business: the invoice exists, the summary counts none of it
        assertThat(summary.customerId()).isEqualTo(customer.getId());
        assertThat(summary.deleted()).isFalse();
        assertThat(summary.saleInvoiceCount()).isZero();
        assertThat(summary.boughtUnits()).isZero();
        assertThat(summary.boughtValue()).isEqualByComparingTo("0");
        assertThat(summary.returnedUnits()).isZero();
        assertThat(summary.returnedValue()).isEqualByComparingTo("0");
    }

    @Test
    void customerSummary_withUnknownId_returnsEmpty() {
        assertThat(reportingService.customerSummary(999_999L)).isEmpty();
    }

    @Test
    void customerSummary_withSoftDeletedCustomer_stillReportsFlaggedAsDeleted() {
        Customer customer = newCustomer("Summary Soft Deleted");
        Product product = newProduct("Summary Deleted A", 10);
        Invoice invoice = sale(customer.getId(), line(product, 2, "20.00"));
        invoiceService.close(invoice.getId(), user);
        customerService.deleteById(customer.getId());

        CustomerSummary summary = reportingService.customerSummary(customer.getId()).orElseThrow();

        assertThat(summary.deleted()).isTrue();
        assertThat(summary.saleInvoiceCount()).isEqualTo(1);
        assertThat(summary.boughtUnits()).isEqualTo(2);
        assertThat(summary.boughtValue()).isEqualByComparingTo("40.00");
        assertThat(summary.returnedUnits()).isZero();
    }

    @Test
    void customerSummary_withAnonymousCashSalePresent_leavesNamedCustomerUnchanged() {
        Customer customer = newCustomer("Summary Beside Cash Sale");
        Product product = newProduct("Summary Cash A", 20);
        Invoice named = sale(customer.getId(), line(product, 2, "15.00"));
        invoiceService.close(named.getId(), user);

        // a cash sale names no customer, so it belongs to no summary by construction
        Invoice anonymous = sale(null, line(product, 5, "15.00"));
        invoiceService.close(anonymous.getId(), user);

        CustomerSummary summary = reportingService.customerSummary(customer.getId()).orElseThrow();
        assertThat(summary.saleInvoiceCount()).isEqualTo(1);
        assertThat(summary.boughtUnits()).isEqualTo(2);
        assertThat(summary.boughtValue()).isEqualByComparingTo("30.00");
    }
}
