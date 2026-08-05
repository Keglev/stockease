package com.stocks.stockease.invoice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.customer.Customer;
import com.stocks.stockease.customer.CustomerService;
import com.stocks.stockease.invoice.web.InvoiceResponse;
import com.stocks.stockease.invoice.web.InvoiceSummaryResponse;
import com.stocks.stockease.movement.MovementReason;
import com.stocks.stockease.movement.RecordMovementCommand;
import com.stocks.stockease.movement.StockMovementService;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.shared.EntityInUseException;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * An invoice is a document: it must state the parties it was issued under whatever later happens to
 * the master data. These tests delete, rename and re-stock behind settled invoices and read them
 * back through the production paths (ADR 033).
 *
 * <p>Every method runs outside a test transaction, so a deletion is a real commit and the reads
 * that follow see committed state rather than the same session's pending changes - which is where
 * the measured failures lived.
 */
@SpringBootTest
@ActiveProfiles("test")
class PartyNameSnapshotIntegrationTest extends AbstractIntegrationTest {

    @Autowired private SupplierService suppliers;
    @Autowired private CustomerService customers;
    @Autowired private ProductService products;
    @Autowired private InvoiceService invoices;
    @Autowired private StockMovementService movements;
    @Autowired private UserRepository userRepository;

    /** Own numbers and SKUs: this class shares its database with the rest of the suite. */
    private static final AtomicInteger N = new AtomicInteger();

    private User admin;

    @BeforeEach
    void setUp() {
        admin = userRepository.findByUsername("snapshot-tester")
                .orElseGet(() -> userRepository.saveAndFlush(
                        new User("snapshot-tester", "hash", "ROLE_ADMIN")));
    }

    private String tag() {
        return "SNAP-" + N.incrementAndGet();
    }

    private Product product(String name) {
        return products.create(name + " " + tag(), "SNAP-" + N.incrementAndGet(), 10.0);
    }

    private Invoice purchaseOf(Supplier supplier, Product product, int qty) {
        return invoices.createInvoice(new CreateInvoiceCommand(InvoiceType.PURCHASE, tag(),
                supplier.getId(), null, LocalDate.now().plusDays(30), BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new CreateInvoiceCommand.ItemLine(product.getId(), qty, new BigDecimal("10.00")))));
    }

    /** Settles an invoice the way the application does: close books the stock, then mark it paid. */
    private void settle(Invoice invoice) {
        invoices.close(invoice.getId(), admin);
        invoices.markAsPaid(invoice.getId());
    }

    private InvoiceResponse detail(long invoiceId) {
        return InvoiceResponse.from(invoices.findDetailById(invoiceId).orElseThrow());
    }

    /**
     * Writes a product's stock down to zero so it becomes deletable. Re-reads the quantity rather
     * than trusting the caller's reference: closing an invoice books stock behind it.
     */
    private void writeOffStock(Product product) {
        int inStock = products.findById(product.getId()).orElseThrow().getQuantity();
        movements.recordMovement(new RecordMovementCommand(product.getId(), MovementReason.DESTROYED,
                inStock, null, null, com.stocks.stockease.movement.MovementRemark.INTERNAL), admin);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void detail_supplierDeletedAfterSettlement_stillNamesTheSupplier() {
        Supplier supplier = suppliers.create("Snapshot Supplier " + tag(), null, null, "1 Main St", null);
        Product item = product("Snapshot Widget");
        Invoice invoice = purchaseOf(supplier, item, 4);
        settle(invoice);

        suppliers.deleteById(supplier.getId());

        InvoiceResponse response = detail(invoice.getId());
        assertThat(response.supplierName()).isEqualTo(supplier.getName());
        assertThat(response.supplierId()).isEqualTo(supplier.getId());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void detail_customerDeletedAfterSettlement_stillNamesTheCustomer() {
        Supplier supplier = suppliers.create("Snapshot Stocker " + tag(), null, null, "2 Main St", null);
        Product item = product("Snapshot Gadget");
        settle(purchaseOf(supplier, item, 20));

        Customer customer = customers.create("Snapshot Customer " + tag(), null, null, "3 Main St", "Springfield");
        Invoice sale = invoices.createInvoice(new CreateInvoiceCommand(InvoiceType.SALE, tag(), null,
                customer.getId(), LocalDate.now().plusDays(30), BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new CreateInvoiceCommand.ItemLine(item.getId(), 3, new BigDecimal("15.00")))));
        settle(sale);

        customers.deleteById(customer.getId());

        InvoiceResponse response = detail(sale.getId());
        assertThat(response.customerName()).isEqualTo(customer.getName());
        assertThat(response.customerId()).isEqualTo(customer.getId());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void detail_productDeletedAfterSettlement_readsInsteadOfFailing() {
        // The headline regression: this read used to raise FetchNotFoundException and answer 500,
        // because the line's product association is non-optional and the restriction hid the row.
        Supplier supplier = suppliers.create("Snapshot Supplier " + tag(), null, null, "4 Main St", null);
        Product item = product("Snapshot Retired");
        Invoice invoice = purchaseOf(supplier, item, 6);
        settle(invoice);
        writeOffStock(item);

        products.deleteById(item.getId(), admin);

        InvoiceResponse response = detail(invoice.getId());
        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).productName()).isEqualTo(item.getName());
        assertThat(response.items().get(0).productId()).isEqualTo(item.getId());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void summaryList_supplierDeletedAfterSettlement_carriesNameAndId() {
        Supplier supplier = suppliers.create("Snapshot Listed " + tag(), null, null, "5 Main St", null);
        Product item = product("Snapshot Listed Widget");
        Invoice invoice = purchaseOf(supplier, item, 2);
        settle(invoice);
        suppliers.deleteById(supplier.getId());

        InvoiceSummaryResponse row = invoices.findAll().stream()
                .filter(i -> i.getId().equals(invoice.getId())).findFirst()
                .map(InvoiceSummaryResponse::from).orElseThrow();

        assertThat(row.supplierName()).isEqualTo(supplier.getName());
        assertThat(row.supplierId()).isEqualTo(supplier.getId());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void detail_supplierRenamedAfterIssuance_keepsTheNameOnTheDocument() {
        Supplier supplier = suppliers.create("Snapshot Original " + tag(), null, null, "6 Main St", null);
        String issuedUnder = supplier.getName();
        Product item = product("Snapshot Renamed");
        Invoice invoice = purchaseOf(supplier, item, 3);
        settle(invoice);

        suppliers.update(supplier.getId(), "Snapshot Renamed Ltd " + tag(), null, null, "6 Main St", null);

        // Immutability, now testable: renaming master data must not rewrite issued documents.
        assertThat(detail(invoice.getId()).supplierName()).isEqualTo(issuedUnder);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void detail_customerRenamedAfterIssuance_keepsTheNameOnTheDocument() {
        // The twin of the supplier rename above, and newly reachable: until customers became
        // editable there was no way to rename one, so ADR 033's guarantee was only half testable on
        // this side. A sale invoice is a document about who bought, at the time they bought.
        Supplier supplier = suppliers.create("Snapshot Seller " + tag(), null, null, "11 Main St", null);
        Product item = product("Snapshot Sold");
        settle(purchaseOf(supplier, item, 10));

        Customer customer = customers.create("Snapshot Buyer " + tag(), null, null, "12 Main St", "Springfield");
        String issuedUnder = customer.getName();
        Invoice sale = invoices.createInvoice(new CreateInvoiceCommand(InvoiceType.SALE, tag(), null,
                customer.getId(), LocalDate.now().plusDays(30), BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new CreateInvoiceCommand.ItemLine(item.getId(), 4, new BigDecimal("15.00")))));
        settle(sale);

        String renamedTo = "Snapshot Buyer Renamed " + tag();
        customers.update(customer.getId(), renamedTo, null, null, "12 Main St", "Springfield");

        // The register moved - asserted first, because without it a no-op update would satisfy the
        // snapshot assertion below by doing nothing at all.
        assertThat(customers.findById(customer.getId()).orElseThrow().getName()).isEqualTo(renamedTo);

        assertThat(detail(sale.getId()).customerName()).isEqualTo(issuedUnder);
        assertThat(detail(sale.getId()).customerId()).isEqualTo(customer.getId());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void summaryList_customerRenamedAfterIssuance_carriesTheIssuanceName() {
        Supplier supplier = suppliers.create("Snapshot Lister " + tag(), null, null, "13 Main St", null);
        Product item = product("Snapshot Listed Sold");
        settle(purchaseOf(supplier, item, 6));

        Customer customer = customers.create("Snapshot Listed Buyer " + tag(), null, null, "14 Main St", null);
        String issuedUnder = customer.getName();
        Invoice sale = invoices.createInvoice(new CreateInvoiceCommand(InvoiceType.SALE, tag(), null,
                customer.getId(), LocalDate.now().plusDays(30), BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new CreateInvoiceCommand.ItemLine(item.getId(), 2, new BigDecimal("15.00")))));
        settle(sale);

        String renamedTo = "Snapshot Listed Renamed " + tag();
        customers.update(customer.getId(), renamedTo, null, null, null, null);
        assertThat(customers.findById(customer.getId()).orElseThrow().getName()).isEqualTo(renamedTo);

        // The ledger row reads from the same snapshot the detail does; both are the document.
        InvoiceSummaryResponse row = invoices.findAll().stream()
                .filter(i -> i.getId().equals(sale.getId())).findFirst()
                .map(InvoiceSummaryResponse::from).orElseThrow();
        assertThat(row.customerName()).isEqualTo(issuedUnder);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void listThenDetail_inOneContext_forADeletedSupplier_doesNotThrow() {
        // The measured session-shape crash: loading the list first left an uninitializable proxy,
        // and the detail read then raised EntityNotFoundException. The de-joined query makes the
        // shape structurally impossible; this proves it rather than assuming it.
        Supplier supplier = suppliers.create("Snapshot Session " + tag(), null, null, "7 Main St", null);
        Product item = product("Snapshot Session Widget");
        Invoice invoice = purchaseOf(supplier, item, 2);
        settle(invoice);
        suppliers.deleteById(supplier.getId());

        assertThatCode(() -> {
            invoices.findAll().forEach(InvoiceSummaryResponse::from);
            detail(invoice.getId());
        }).doesNotThrowAnyException();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void customerReturn_againstADeletedProduct_isRefusedAndSucceedsAfterRestore() {
        // A customer return is the case the guard exists for: it brings stock back, and stock on a
        // deleted product would be invisible everywhere. A supplier return cannot reach the guard at
        // all - it sends stock out, and a product can only be deleted once its stock is zero.
        Supplier supplier = suppliers.create("Snapshot Returner " + tag(), null, null, "8 Main St", null);
        Product item = product("Snapshot Returnable");
        settle(purchaseOf(supplier, item, 5));
        Customer customer = customers.create("Snapshot Buyer " + tag(), null, null, "10 Main St", "Springfield");
        Invoice sale = invoices.createInvoice(new CreateInvoiceCommand(InvoiceType.SALE, tag(), null,
                customer.getId(), LocalDate.now().plusDays(30), BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new CreateInvoiceCommand.ItemLine(item.getId(), 5, new BigDecimal("18.00")))));
        settle(sale);
        long itemId = invoices.findDetailById(sale.getId()).orElseThrow().getItems().get(0).getId();

        // The whole batch sold, so stock is zero and the product is deletable.
        products.deleteById(item.getId(), admin);

        assertThatThrownBy(() -> movements.recordMovement(new RecordMovementCommand(item.getId(),
                MovementReason.RETURN_FROM_CUSTOMER, 2, itemId, null, null), admin))
                .isInstanceOf(EntityInUseException.class)
                .hasMessage("Cannot register a return for '" + item.getName()
                        + "': the product is deleted. Restore it first, then record the return.");

        // The documented manual path: restore, then the same return goes through unchanged.
        products.restore(item.getId(), admin);
        movements.recordMovement(new RecordMovementCommand(item.getId(),
                MovementReason.RETURN_FROM_CUSTOMER, 2, itemId, null, null), admin);

        assertThat(invoices.findItemById(itemId).orElseThrow().getReturnedQty()).isEqualTo(2);
        assertThat(products.findById(item.getId()).orElseThrow().getQuantity()).isEqualTo(2);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void delete_productHoldingStock_isRefusedUntilTheStockIsZero() {
        Supplier supplier = suppliers.create("Snapshot Stocked " + tag(), null, null, "9 Main St", null);
        Product item = product("Snapshot Stocked Widget");
        settle(purchaseOf(supplier, item, 7));

        assertThatThrownBy(() -> products.deleteById(item.getId(), admin))
                .isInstanceOf(EntityInUseException.class)
                .hasMessage("Cannot delete product '" + item.getName() + "': 7 units are still in stock.");

        writeOffStock(products.findById(item.getId()).orElseThrow());

        assertThat(products.deleteById(item.getId(), admin)).isTrue();
    }
}
