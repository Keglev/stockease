package com.stocks.stockease.shared.web;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

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

/*
 * Scenario builders shared by the three error-envelope spec files. Every helper writes through the
 * domain services rather than the repositories, so each refusal is provoked from state the
 * application could actually have reached.
 *
 * These tests commit - the endpoints run in their own transactions and nothing rolls back. That
 * makes the state they leave behind everyone else's problem, and this class is where the answer
 * lives: per-test names and SKUs off the single counter below, and one shared admin row.
 *
 * Out of scope: what any case asserts. Nothing here calls MockMvc or expects a status; a helper
 * that decided an assertion would put the claim somewhere the spec file reading it cannot see.
 */
class ErrorEnvelopeTestFixtures {

    /** The admin every spec file authenticates as; the controller resolves it against a real row. */
    static final String TESTER = "envelope-tester";

    /*
     * ONE counter for the whole JVM, deliberately static on a class all three spec files share.
     * Product names, SKUs and invoice numbers are unique among live rows and these tests commit, so
     * a per-class counter would restart at 1 in each spec file and the second class to run would
     * collide with values the first one committed. Keeping it here is what makes the split safe.
     */
    static final AtomicInteger N = new AtomicInteger();

    private final SupplierService suppliers;
    private final CustomerService customers;
    private final ProductService products;
    private final InvoiceService invoices;

    final User admin;

    ErrorEnvelopeTestFixtures(SupplierService suppliers, CustomerService customers,
            ProductService products, InvoiceService invoices, UserRepository userRepository) {
        this.suppliers = suppliers;
        this.customers = customers;
        this.products = products;
        this.invoices = invoices;
        this.admin = userRepository.findByUsername(TESTER)
                .orElseGet(() -> userRepository.saveAndFlush(new User(TESTER, "hash", "ROLE_ADMIN")));
    }

    static String tag() {
        return "CODE-" + N.incrementAndGet();
    }

    static String returnBody(long invoiceItemId, long productId, String reason, int quantity) {
        return """
                {"invoiceItemId":%d,"productId":%d,"reason":"%s","quantity":%d}"""
                .formatted(invoiceItemId, productId, reason, quantity);
    }

    /**
     * A body for the standalone stock-movement endpoint, with no remark.
     *
     * <p>The remark is left off rather than made a parameter because the one case here that reaches
     * this endpoint's own validation is the loss that forgot one; a caller wanting to record a
     * successful loss would need the field, and no envelope case does.
     */
    static String movementBody(long productId, String reason, int quantity) {
        return """
                {"productId":%d,"reason":"%s","quantity":%d}"""
                .formatted(productId, reason, quantity);
    }

    /**
     * A create-invoice body with one good line, for the party-rule refusals to run into.
     *
     * <p>The party ids are the only thing a caller varies: every other field is valid here on
     * purpose, so the refusal under test is the one the endpoint reaches rather than whichever
     * constraint the request record checks first.
     */
    static String invoiceBody(String type, Long supplierId, Long customerId, long productId) {
        return """
                {"type":"%s","invoiceNumber":"%s","supplierId":%s,"customerId":%s,\
                "dueDate":"2030-01-01","items":[{"productId":%d,"quantity":2,"unitPrice":10.00}]}"""
                .formatted(type, tag(), supplierId, customerId, productId);
    }

    void settle(Invoice invoice) {
        invoices.close(invoice.getId(), admin);
        invoices.markAsPaid(invoice.getId());
    }

    long firstItemId(Invoice invoice) {
        return invoices.findDetailById(invoice.getId()).orElseThrow().getItems().get(0).getId();
    }

    /** A live product holding the given name and SKU, for the collisions below to run into. */
    Product live(String name, String sku) {
        return products.create(name, sku, 10.0);
    }

    Supplier supplier(String label) {
        return suppliers.create(label + " " + tag(), null, null, "1 Main St", null);
    }

    Customer customer(String label) {
        return customers.create(label + " " + tag(), null, null, "2 Main St", "Springfield");
    }

    /** A purchase invoice left OPEN, so it still pins the supplier and the product on its line. */
    Invoice openPurchase(Supplier supplier, Product item, int quantity) {
        return invoices.createInvoice(new CreateInvoiceCommand(InvoiceType.PURCHASE, tag(),
                supplier.getId(), null, LocalDate.now().plusDays(30), BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new CreateInvoiceCommand.ItemLine(item.getId(), quantity, new BigDecimal("10.00")))));
    }

    /** A sale invoice left OPEN, the customer-side counterpart of {@link #openPurchase}. */
    Invoice openSale(Customer customer, Product item, int quantity) {
        return invoices.createInvoice(new CreateInvoiceCommand(InvoiceType.SALE, tag(), null,
                customer.getId(), LocalDate.now().plusDays(30), BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new CreateInvoiceCommand.ItemLine(item.getId(), quantity, new BigDecimal("18.00")))));
    }

    /** A settled purchase, left closed and paid - the state four of the five refusals below need. */
    Invoice settledPurchase(int quantity) {
        return purchase(quantity).invoice();
    }

    /**
     * The product from a settled purchase, holding the units that purchase booked.
     *
     * <p>Same builder as {@link #settledPurchase} read from the other end: closing is what books the
     * stock, so a product with a non-zero quantity and no open invoice pinning it is exactly what
     * the stocked-product refusal needs and what no open-invoice veto would intercept first.
     */
    Product stockedProduct(int quantity) {
        return purchase(quantity).item();
    }

    private Purchase purchase(int quantity) {
        Supplier supplier = supplier("Envelope Lifecycle");
        Product item = live("Envelope Lifecycle Widget " + tag(), "LIFE-" + N.incrementAndGet());
        Invoice invoice = openPurchase(supplier, item, quantity);
        settle(invoice);
        return new Purchase(item, invoice);
    }

    private record Purchase(Product item, Invoice invoice) {}

    /**
     * Buys a batch and sells all of it, both settled. Leaves the product live at zero stock, which is
     * the state both conflicts below are provoked from - one by deleting it, one by returning against
     * the purchase line that no longer has the units to give back.
     */
    Sold buyAndSellOut(int quantity) {
        Supplier supplier = suppliers.create("Envelope Supplier " + tag(), null, null, "1 Main St", null);
        Product item = products.create("Envelope Widget " + tag(), "ENV-" + N.incrementAndGet(), 10.0);
        Invoice purchase = invoices.createInvoice(new CreateInvoiceCommand(InvoiceType.PURCHASE, tag(),
                supplier.getId(), null, LocalDate.now().plusDays(30), BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new CreateInvoiceCommand.ItemLine(item.getId(), quantity, new BigDecimal("10.00")))));
        settle(purchase);

        Customer customer = customers.create("Envelope Buyer " + tag(), null, null, "2 Main St", "Springfield");
        Invoice sale = invoices.createInvoice(new CreateInvoiceCommand(InvoiceType.SALE, tag(), null,
                customer.getId(), LocalDate.now().plusDays(30), BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new CreateInvoiceCommand.ItemLine(item.getId(), quantity, new BigDecimal("18.00")))));
        settle(sale);

        return new Sold(item, purchase, sale);
    }

    record Sold(Product item, Invoice purchase, Invoice sale) {}
}
