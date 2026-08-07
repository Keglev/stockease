package com.stocks.stockease.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

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

/*
 * Scenario builders shared by the three reporting spec files. Every helper writes through the
 * domain services rather than the repositories, so the reports are read against data the
 * application could actually have produced.
 *
 * These tests commit - each one runs NOT_SUPPORTED, so nothing rolls back. That makes the state
 * they leave behind everyone else's problem, and this class is where the answer lives: per-test
 * product names, one shared user, and the single invoice-number counter below.
 *
 * Out of scope: reading the reports. Each spec file queries and asserts for itself; nothing here
 * calls the reporting services.
 */
class ReportingTestFixtures {

    /*
     * ONE counter for the whole JVM, deliberately static on a class the three spec files share.
     * Invoice numbers are unique among live invoices and these tests commit, so a per-class
     * counter would restart at 1 in each spec file and the second class to run would collide with
     * numbers the first one committed. Keeping it here is what makes the split safe.
     */
    private static final AtomicInteger NUMBERS = new AtomicInteger();

    static String nextNumber() {
        return "TST-RPT-" + NUMBERS.incrementAndGet();
    }

    private final ProductService productService;
    private final SupplierService supplierService;
    private final InvoiceService invoiceService;
    private final StockMovementService stockMovementService;

    /* The one reporting user, seeded on first use and reused by every later test. */
    final User user;

    ReportingTestFixtures(ProductService productService, SupplierService supplierService,
            InvoiceService invoiceService, StockMovementService stockMovementService,
            UserRepository userRepository) {
        this.productService = productService;
        this.supplierService = supplierService;
        this.invoiceService = invoiceService;
        this.stockMovementService = stockMovementService;
        this.user = userRepository.findByUsername("report-tester")
                .orElseGet(() -> userRepository.saveAndFlush(new User("report-tester", "hash", "ROLE_ADMIN")));
    }

    /* Products start at quantity 0 so all stock exists only via movements the reports read. */
    Product newProduct(String name, String purchasePrice) {
        return productService.create(name, "RPT-" + name.hashCode(), new BigDecimal(purchasePrice).doubleValue());
    }

    Invoice closedPurchase(long supplierId, long productId, int qty, String unitPrice) {
        Invoice invoice = invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.PURCHASE,
                nextNumber(), supplierId, null, LocalDate.now(), null, null,
                List.of(new CreateInvoiceCommand.ItemLine(productId, qty, new BigDecimal(unitPrice)))));
        invoiceService.close(invoice.getId(), user);
        return invoice;
    }

    Invoice closedSale(long productId, int qty, String unitPrice) {
        Invoice invoice = invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.SALE, nextNumber(),
                null, null, LocalDate.now(), null, null,
                List.of(new CreateInvoiceCommand.ItemLine(productId, qty, new BigDecimal(unitPrice)))));
        invoiceService.close(invoice.getId(), user);
        return invoice;
    }

    static Long firstItemId(Invoice invoice) {
        return invoice.getItems().get(0).getId();
    }

    void record(MovementReason reason, long productId, int qty, Long itemId) {
        // LOST and DESTROYED require a remark; these scenarios are about valuation, not about which
        // cause was recorded, so the neutral member stands in for all of them
        MovementRemark remark = reason == MovementReason.LOST || reason == MovementReason.DESTROYED
                ? MovementRemark.INTERNAL
                : null;
        stockMovementService.recordMovement(
                new RecordMovementCommand(productId, reason, qty, itemId, null, remark), user);
    }

    /* Product id and supplier id of one full purchase-sale-return-loss scenario. */
    record Scenario(long productId, long supplierId) {
    }

    /*
     * Builds scenario A: buy 10 at 10.00, sell 4 at 30.00, take 1 back from the customer,
     * return 2 to the supplier and lose 1.
     */
    Scenario scenarioA(String productName) {
        Supplier supplier = supplierService.create(productName + " Supplier", null, null, "1 Main St", null);
        Product product = newProduct(productName, "10.00");
        Invoice purchase = closedPurchase(supplier.getId(), product.getId(), 10, "10.00");
        Invoice sale = closedSale(product.getId(), 4, "30.00");
        record(MovementReason.RETURN_FROM_CUSTOMER, product.getId(), 1, firstItemId(sale));
        record(MovementReason.RETURNED_TO_SUPPLIER, product.getId(), 2, firstItemId(purchase));
        record(MovementReason.LOST, product.getId(), 1, null);
        return new Scenario(product.getId(), supplier.getId());
    }
}
