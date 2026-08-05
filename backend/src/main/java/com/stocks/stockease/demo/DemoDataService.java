package com.stocks.stockease.demo;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.stocks.stockease.customer.Customer;
import com.stocks.stockease.customer.CustomerService;
import com.stocks.stockease.invoice.CreateInvoiceCommand;
import com.stocks.stockease.invoice.CreateInvoiceCommand.ItemLine;
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
import com.stocks.stockease.security.UserService;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;

import lombok.RequiredArgsConstructor;

/**
 * Rebuilds the demo database: a wipe of every domain table followed by a curated baseline built
 * through the same services the API uses.
 *
 * <p>The baseline is designed to populate the product views, the movement and audit histories, and
 * every reporting tab at once: purchases and sales at differing unit prices so profit per product has
 * shape, invoices due across the coming three weeks plus several already overdue, returns in both
 * directions, write-offs, a walk-in sale with no customer, and one product left below the low-stock
 * threshold.
 *
 * <p>The services stamp every row with the instant the seed runs, so {@link DemoTemporalSpread}
 * backdates the finished baseline across the past six months (ADR 027). Read the two together: the
 * quantities, prices and due dates are decided here, and only the moments are decided there.
 */
@Service
@ConditionalOnDemoMode
@RequiredArgsConstructor
public class DemoDataService {

    private static final Logger log = LoggerFactory.getLogger(DemoDataService.class);

    /** The demo ADMIN (V15); closes invoices, so it is the actor on every booked movement. */
    private static final String ADMIN_USERNAME = "julia.brandt";

    /** The demo USER (V10); records the hand-entered movements so the actor column is not uniform. */
    private static final String STAFF_USERNAME = "markus.weber";

    /**
     * Every domain table, children before parents.
     *
     * <p>Derived from the Flyway migrations: V2 product, V6 supplier / invoice / invoice_item,
     * V7 stock_movement, V8 product_change_log, V11 customer. {@code app_user} is deliberately absent -
     * accounts are permanent data that the reset must never touch - and so is
     * {@code flyway_schema_history}, which describes the schema rather than the data in it.
     */
    private static final List<String> DOMAIN_TABLES = List.of(
            "product_change_log", "stock_movement", "invoice_item", "invoice", "customer", "supplier", "product");

    private final JdbcTemplate jdbcTemplate;
    private final DemoTemporalSpread temporalSpread;
    private final ProductService productService;
    private final SupplierService supplierService;
    private final CustomerService customerService;
    private final InvoiceService invoiceService;
    private final StockMovementService stockMovementService;
    private final UserService userService;

    /**
     * Wipes every domain table and rebuilds the curated baseline.
     *
     * @throws IllegalStateException if seeding fails part-way through
     */
    public void resetToBaseline() {
        wipe();
        try {
            seed();
            // Runs after the seed rather than during it: the services stamp their own rows, so the
            // only moment the history can be spread apart is once it all exists (ADR 027).
            temporalSpread.apply();
        } catch (RuntimeException ex) {
            // Each service call commits on its own, so a mid-seed failure leaves real, partial data
            // behind: dashboards would render and quietly understate everything. Fail loudly instead.
            log.error("Demo seeding failed - the demo database is left partially seeded.", ex);
            throw new IllegalStateException("Demo seeding failed; the demo data is incomplete.", ex);
        }
        log.info("Demo baseline restored.");
    }

    /**
     * Deletes every row of domain data, leaving {@code app_user} and the migration history untouched.
     *
     * <p>Raw SQL rather than the domain services on purpose. The repositories are module-internal and
     * the services rightly expose no bulk deletion - nothing in the business domain ever empties the
     * catalogue. Wiping is infrastructure, not domain behaviour, so one statement in one place beats
     * widening eight domain APIs with an operation only the demo would ever call. {@code CASCADE}
     * reaches only tables that reference the listed ones, all of which are listed; {@code app_user} is
     * referenced BY them and is therefore never in scope.
     */
    public void wipe() {
        jdbcTemplate.execute("TRUNCATE TABLE " + String.join(", ", DOMAIN_TABLES) + " RESTART IDENTITY CASCADE");
        log.info("Demo wipe removed all domain data from {} tables.", DOMAIN_TABLES.size());
    }

    /** Builds the baseline through the public services; every step is a real transaction of its own. */
    private void seed() {
        User admin = requireUser(ADMIN_USERNAME);
        User staff = requireUser(STAFF_USERNAME);
        List<Supplier> suppliers = seedSuppliers();
        List<Customer> customers = seedCustomers();
        List<Product> products = seedProducts();

        // No opening-balance step: every unit the baseline holds arrives by closing a purchase
        // invoice (ADR 021), which is also what sets each product's price - see seedProducts.
        List<Invoice> purchases = seedPurchaseInvoices(suppliers, products, admin);
        List<Invoice> sales = seedSaleInvoices(customers, products, admin);
        seedAdjustments(purchases, sales, products, staff);
        seedPayments(purchases, sales);
    }

    /** Loads a demo account, refusing to invent one: users are migration data, never seeded here. */
    private User requireUser(String username) {
        return userService.findByUsername(username).orElseThrow(() -> new IllegalStateException(
                "Demo user '" + username + "' is missing; it is created by migration, not by seeding."));
    }

    private List<Supplier> seedSuppliers() {
        return List.of(
                supplierService.create("Nordwerk Handels GmbH", null, null, "Hafenstraße 12, 20457 Hamburg", null),
                supplierService.create("Bayerische Werkzeug AG", null, null, "Lindwurmstraße 88, 80337 München", null),
                supplierService.create("Rheinland Elektro KG", null, null, "Domkloster 4, 50667 Köln", null),
                supplierService.create("Sachsen Logistik und Bedarf GmbH", null, null, "Prager Straße 21, 01069 Dresden", null),
                supplierService.create("Weserbergland Papierwaren e.K.", null, null, "Osterstraße 7, 31785 Hameln", null));
    }

    private List<Customer> seedCustomers() {
        return List.of(
                customerService.create("Kaufhaus Lindner GmbH", "einkauf@lindner-kaufhaus.de",
                        "+49 30 4422100", "Kantstraße 45", "Berlin"),
                customerService.create("Baumarkt Steinmeyer KG", "bestellung@steinmeyer-baumarkt.de",
                        "+49 511 3378120", "Vahrenwalder Straße 210", "Hannover"),
                customerService.create("Bürobedarf Hoffmann e.K.", "kontakt@hoffmann-buero.de",
                        "+49 69 2855440", "Zeil 90", "Frankfurt am Main"),
                customerService.create("Technik Zentrum Adler GmbH", "vertrieb@adler-technik.de",
                        "+49 711 6649010", "Königstraße 27", "Stuttgart"),
                customerService.create("Gastro Service Weinert GmbH", "disposition@weinert-gastro.de",
                        "+49 221 5590430", "Aachener Straße 133", "Köln"));
    }

    /**
     * Creates the catalogue at zero stock; every unit the demo holds arrives by closing a purchase
     * invoice, so the cost basis the profit report reads always has a document behind it.
     *
     * <p>The prices passed here are starting values only. Each product's live price is
     * <em>derived</em>: closing a purchase invoice reprices its lines to what that invoice paid
     * (ADR 019), so after seeding a product carries the unit price of its last closed purchase line,
     * not the figure below. Product 0 is bought twice on purpose - 58.00 first, then 61.50 - and the
     * invoices close in that order, so it ends at the later 61.50 rather than the earlier price.
     */
    private List<Product> seedProducts() {
        List<Product> products = new ArrayList<>();
        // SKUs are operator-assigned master data (ADR 018), so the baseline carries the kind a German
        // merchant would keep: a three-letter category stem and a running number, not a generated id.
        products.add(productService.create("Akkuschrauber ASB 18V", "WKZ-0001", 64.90));
        products.add(productService.create("Werkzeugkoffer 128-teilig", "WKZ-0002", 89.50));
        products.add(productService.create("Industriestaubsauger IS 30", "REI-0001", 149.00));
        products.add(productService.create("LED-Baustrahler 50W", "ELT-0001", 32.75));
        products.add(productService.create("Kabeltrommel 25m H07RN-F", "ELT-0002", 44.20));
        products.add(productService.create("Sicherheitsschuhe S3 Größe 43", "ARB-0001", 58.40));
        products.add(productService.create("Arbeitshandschuhe Nitril 12er-Pack", "ARB-0002", 11.95));
        products.add(productService.create("Bürostuhl Ergo Line", "BUE-0001", 179.00));
        products.add(productService.create("Aktenschrank Stahl 4 Fächer", "BUE-0002", 214.50));
        products.add(productService.create("Kopierpapier A4 80g Karton", "BUE-0003", 27.30));
        products.add(productService.create("Kaffeevollautomat Pro 300", "KUE-0001", 429.00));
        products.add(productService.create("Reinigungswagen Kompakt", "REI-0002", 96.80));
        return products;
    }

    /**
     * Purchases from all five suppliers, closed except the last so an OPEN purchase exists. Due dates
     * straddle today: two long overdue, two inside the default due-soon window, the rest across the
     * coming three weeks so the bucket chart has columns.
     *
     * <p>Closing these is what puts stock on the shelves and what fixes each product's price, so
     * every product the sales below draw on is bought here first, in enough quantity to cover them.
     */
    private List<Invoice> seedPurchaseInvoices(List<Supplier> suppliers, List<Product> products, User admin) {
        List<Invoice> invoices = new ArrayList<>();
        // Purchase numbers mimic the suppliers' OWN document numbers, so each supplier follows its own
        // house convention rather than one shared pattern - that is what an operator actually copies
        // off the paperwork (ADR 022). Sales below use the single house sequence instead.
        invoices.add(closedPurchase(suppliers.get(0), "RE-2026-0117", days(-24), admin,
                line(products.get(0), 40, "58.00"), line(products.get(1), 25, "80.00")));
        invoices.add(closedPurchase(suppliers.get(1), "BWA-2026-0442", days(5), admin,
                line(products.get(2), 12, "132.00"), line(products.get(3), 60, "26.50")));
        invoices.add(closedPurchase(suppliers.get(2), "2026/RH/00891", days(12), admin,
                line(products.get(4), 35, "38.00"), line(products.get(5), 30, "49.00")));
        invoices.add(closedPurchase(suppliers.get(3), "SL-26-004417", days(18), admin,
                line(products.get(6), 200, "8.90"), line(products.get(11), 10, "78.00")));
        // second purchase of product 0 at a different unit price: profit per product must not collapse
        // to one cost figure
        invoices.add(closedPurchase(suppliers.get(0), "RE-2026-0163", days(3), admin,
                line(products.get(0), 10, "61.50"), line(products.get(7), 20, "142.00"),
                line(products.get(8), 8, "170.00"), line(products.get(10), 9, "352.00")));
        // The paper supplier's delivered order. It is what stocks the copier paper the walk-in sale
        // sells, which the open order below cannot do: an OPEN invoice books nothing.
        invoices.add(closedPurchase(suppliers.get(4), "WP-2026-0075", days(-30), admin,
                line(products.get(9), 90, "21.50")));
        // Two settled orders, so the cash-flow report has outflow to show. Their lines repeat prices
        // these products were already bought at: a different price would reprice the product (ADR 019)
        // and move figures the rest of the baseline pins.
        invoices.add(closedPurchase(suppliers.get(2), "2026/RH/00934", days(-14), admin,
                line(products.get(4), 15, "38.00"), line(products.get(5), 10, "49.00")));
        invoices.add(closedPurchase(suppliers.get(4), "WP-2026-0091", days(-9), admin,
                line(products.get(9), 40, "21.50")));
        // still open, so the demo has a purchase in each state; a repeat order from the same supplier
        invoices.add(openPurchase(suppliers.get(4), "WP-2026-0088", days(9),
                line(products.get(9), 80, "21.50")));
        return invoices;
    }

    /**
     * Sales across four named customers plus one walk-in with no customer at all, closed except the
     * last. Two are already overdue; margins differ per line so the profit charts are not flat.
     */
    private List<Invoice> seedSaleInvoices(List<Customer> customers, List<Product> products, User admin) {
        List<Invoice> invoices = new ArrayList<>();
        // One unbroken house sequence, because these are the numbers this business issues itself.
        invoices.add(closedSale(customers.get(0), "AR-2026-0001", days(-16), admin,
                line(products.get(0), 8, "94.90"), line(products.get(3), 15, "49.90")));
        invoices.add(closedSale(customers.get(1), "AR-2026-0002", days(6), admin,
                line(products.get(1), 6, "129.00"), line(products.get(5), 10, "79.90")));
        // walk-in cash sale: no customer, which is what makes the reports show "Cash sale"
        invoices.add(closedSale(null, "AR-2026-0003", days(0), admin,
                line(products.get(6), 24, "18.90"), line(products.get(9), 12, "39.90")));
        invoices.add(closedSale(customers.get(2), "AR-2026-0004", days(14), admin,
                line(products.get(7), 9, "239.00"), line(products.get(8), 5, "289.00")));
        invoices.add(closedSale(customers.get(3), "AR-2026-0005", days(20), admin,
                line(products.get(2), 4, "199.00"), line(products.get(10), 2, "549.00")));
        invoices.add(closedSale(customers.get(0), "AR-2026-0006", days(-4), admin,
                line(products.get(4), 9, "69.90"), line(products.get(0), 4, "89.90")));
        // Two settled sales, so the cash-flow report has inflow to show against the outflow above.
        // Both draw on well-stocked products: the one product the baseline leaves at 3 units is what
        // keeps the low-stock report non-empty, so nothing here touches it.
        invoices.add(closedSale(customers.get(1), "AR-2026-0008", days(-12), admin,
                line(products.get(3), 10, "49.90"), line(products.get(4), 5, "69.90")));
        invoices.add(closedSale(customers.get(2), "AR-2026-0009", days(-7), admin,
                line(products.get(9), 20, "39.90"), line(products.get(6), 30, "18.90")));
        invoices.add(openSale(customers.get(4), "AR-2026-0007", days(11),
                line(products.get(11), 3, "139.00")));
        return invoices;
    }

    /**
     * The movements the seeder records by hand.
     *
     * <p>Deliberately only these four reasons, one of which is recorded twice: PURCHASE and SOLD are
     * booked by the invoice module's own listener when an invoice closes, and
     * {@code StockMovementService.validateNotAlreadyRecorded} rejects a second one per line -
     * recording them here would fail, and rightly so.
     */
    private void seedAdjustments(List<Invoice> purchases, List<Invoice> sales, List<Product> products, User staff) {
        Product drill = products.get(0);
        // partial customer return against the first sale line: 2 of the 8 units come back
        record(staff, MovementReason.RETURN_FROM_CUSTOMER, drill, 2, itemId(sales.get(0), 0), null);
        // Second customer return, and the only one on a PAID sale: cash flow reads inflow net of
        // returns over paid invoices only, so the return above - on an unpaid invoice the report
        // ignores by definition - leaves that basis with nothing to net.
        record(staff, MovementReason.RETURN_FROM_CUSTOMER, products.get(9), 4, itemId(sales.get(7), 0), null);
        // return to supplier against the first purchase line: 5 of the 40 units go back
        record(staff, MovementReason.RETURNED_TO_SUPPLIER, drill, 5, itemId(purchases.get(0), 0), null);
        // two different remarks on purpose: the loss report is only worth grouping if the baseline
        // shows the taxonomy has more than one member in use
        record(staff, MovementReason.LOST, drill, 3, null, null, MovementRemark.IN_TRANSIT_TO_CUSTOMER);
        record(staff, MovementReason.DESTROYED, products.get(1), 2, null, null, MovementRemark.EXPIRED);
    }

    /**
     * Settles six invoices so the due-date and overdue reports distinguish paid from outstanding and
     * the cash-flow report has both directions to show.
     *
     * <p>Only invoices added for this purpose are settled. Paying one of the outstanding ones would
     * remove it from the due-soon and overdue listings, which the baseline requires to stay populated.
     */
    private void seedPayments(List<Invoice> purchases, List<Invoice> sales) {
        invoiceService.markAsPaid(purchases.get(2).getId());
        invoiceService.markAsPaid(purchases.get(6).getId());
        invoiceService.markAsPaid(purchases.get(7).getId());
        invoiceService.markAsPaid(sales.get(2).getId());
        invoiceService.markAsPaid(sales.get(6).getId());
        invoiceService.markAsPaid(sales.get(7).getId());
    }

    private Invoice closedPurchase(Supplier supplier, String number, LocalDate dueDate, User admin,
            ItemLine... lines) {
        Invoice invoice = openPurchase(supplier, number, dueDate, lines);
        invoiceService.close(invoice.getId(), admin);
        return invoice;
    }

    private Invoice openPurchase(Supplier supplier, String number, LocalDate dueDate, ItemLine... lines) {
        return invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.PURCHASE, number,
                supplier.getId(), null, dueDate, new BigDecimal("2.50"), BigDecimal.ZERO, List.of(lines)));
    }

    private Invoice closedSale(Customer customer, String number, LocalDate dueDate, User admin, ItemLine... lines) {
        Invoice invoice = openSale(customer, number, dueDate, lines);
        invoiceService.close(invoice.getId(), admin);
        return invoice;
    }

    private Invoice openSale(Customer customer, String number, LocalDate dueDate, ItemLine... lines) {
        Long customerId = customer == null ? null : customer.getId();
        return invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.SALE, number, null, customerId,
                dueDate, new BigDecimal("1.50"), BigDecimal.ZERO, List.of(lines)));
    }

    private void record(User user, MovementReason reason, Product product, int quantity, Long invoiceItemId,
            BigDecimal unitCost) {
        record(user, reason, product, quantity, invoiceItemId, unitCost, null);
    }

    private void record(User user, MovementReason reason, Product product, int quantity, Long invoiceItemId,
            BigDecimal unitCost, MovementRemark remark) {
        stockMovementService.recordMovement(
                new RecordMovementCommand(product.getId(), reason, quantity, invoiceItemId, unitCost, remark), user);
    }

    private static ItemLine line(Product product, int quantity, String unitPrice) {
        return new ItemLine(product.getId(), quantity, new BigDecimal(unitPrice));
    }

    private static Long itemId(Invoice invoice, int index) {
        return invoice.getItems().get(index).getId();
    }

    private static LocalDate days(int offset) {
        return LocalDate.now().plusDays(offset);
    }
}
