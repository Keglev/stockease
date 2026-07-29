package com.stocks.stockease.invoice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

import com.stocks.stockease.invoice.internal.InvoiceRepository;
import com.stocks.stockease.invoice.web.InvoiceResponse;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.internal.ProductRepository;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.shared.DuplicateResourceException;
import com.stocks.stockease.shared.InsufficientStockException;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.internal.SupplierRepository;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Tests the invoice lifecycle end to end against PostgreSQL: creation, the event-driven stock booking
 * performed on close, its rollback, and full-return detection. Every method runs outside a test
 * transaction so the assertions observe committed state rather than the test's own session.
 */
@SpringBootTest
@ActiveProfiles("test")
class InvoiceLifecycleIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private InvoiceService invoiceService;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User user;

    @BeforeEach
    void setUp() {
        // these tests commit, so the shared user is reused rather than re-inserted
        user = userRepository.findByUsername("invoice-tester")
                .orElseGet(() -> userRepository.saveAndFlush(new User("invoice-tester", "hash", "ROLE_ADMIN")));
    }

    private Product newProduct(String name, int quantity) {
        Product product = new Product(name, quantity, 5.0);
        // explicit since the SKU is no longer generated on persist; unique per product name
        product.setSku("TST-LIFE-" + name.hashCode());
        return productRepository.saveAndFlush(product);
    }

    private Supplier newSupplier() {
        return supplierRepository.saveAndFlush(new Supplier(null, "Acme", "1 Main St", null, null));
    }

    private static CreateInvoiceCommand.ItemLine line(Product product, int quantity) {
        return new CreateInvoiceCommand.ItemLine(product.getId(), quantity, new BigDecimal("15.00"));
    }

    /**
     * Invoice numbers are unique among live invoices, and these tests commit into the container the
     * whole suite shares, so each one takes a fresh number from a class-prefixed counter.
     */
    private static final AtomicInteger NUMBERS = new AtomicInteger();

    private static String nextNumber() {
        return "TST-LIFE-" + NUMBERS.incrementAndGet();
    }

    private static CreateInvoiceCommand saleCommand(CreateInvoiceCommand.ItemLine... lines) {
        return saleCommand(nextNumber(), lines);
    }

    /** Same, with the number pinned by the caller - the duplicate tests need to repeat one. */
    private static CreateInvoiceCommand saleCommand(String number, CreateInvoiceCommand.ItemLine... lines) {
        return new CreateInvoiceCommand(InvoiceType.SALE, number, null, null, LocalDate.now(), null, null,
                List.of(lines));
    }

    private static CreateInvoiceCommand purchaseCommand(Supplier supplier, CreateInvoiceCommand.ItemLine... lines) {
        return new CreateInvoiceCommand(InvoiceType.PURCHASE, nextNumber(), supplier.getId(), null,
                LocalDate.now(), null, null, List.of(lines));
    }

    /** Counts movement rows booked against an invoice line; SQL avoids traversing a lazy link outside a session. */
    private int movementCount(Long invoiceItemId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM stock_movement WHERE invoice_item_id = ?", Integer.class, invoiceItemId);
    }

    private BigDecimal soldPrice(Long invoiceItemId) {
        return jdbcTemplate.queryForObject(
                "SELECT sold_price FROM stock_movement WHERE invoice_item_id = ?", BigDecimal.class, invoiceItemId);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void createInvoice_purchaseWithTwoLines_persistsGraph() {
        Product first = newProduct("Lifecycle Create A", 10);
        Product second = newProduct("Lifecycle Create B", 10);

        Invoice created = invoiceService.createInvoice(
                purchaseCommand(newSupplier(), line(first, 2), line(second, 3)));

        assertThat(created.getId()).isNotNull();
        assertThat(created.getItems()).hasSize(2);
        assertThat(created.getItems()).allSatisfy(item -> assertThat(item.getId()).isNotNull());
        Invoice reloaded = invoiceRepository.findById(created.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(InvoiceStatus.OPEN);
        assertThat(reloaded.getClosedAt()).isNull();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void createInvoice_withDuplicateLiveNumber_throwsDuplicateResourceException() {
        Product product = newProduct("Lifecycle Duplicate Number", 10);
        String number = nextNumber();
        invoiceService.createInvoice(saleCommand(number, line(product, 1)));

        assertThatThrownBy(() -> invoiceService.createInvoice(saleCommand(number, line(product, 1))))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessage("An invoice numbered '" + number + "' already exists.");
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void createInvoice_reusingADeletedInvoicesNumber_succeeds() {
        Product product = newProduct("Lifecycle Reused Number", 10);
        String number = nextNumber();
        Invoice first = invoiceService.createInvoice(saleCommand(number, line(product, 1)));
        invoiceService.deleteById(first.getId());

        Invoice second = invoiceService.createInvoice(saleCommand(number, line(product, 1)));

        // pins the partial index's scope: uniqueness covers live invoices only
        assertThat(second.getId()).isNotNull().isNotEqualTo(first.getId());
        assertThat(second.getInvoiceNumber()).isEqualTo(number);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void closeInvoice_saleWithSufficientStock_booksMovementsAndDecreasesStock() {
        Product product = newProduct("Lifecycle Close Sufficient", 10);
        Invoice invoice = invoiceService.createInvoice(saleCommand(line(product, 4)));
        Long itemId = invoice.getItems().get(0).getId();

        invoiceService.close(invoice.getId(), user);

        assertThat(invoiceRepository.findById(invoice.getId()).orElseThrow().getStatus())
                .isEqualTo(InvoiceStatus.CLOSED);
        assertThat(productRepository.findById(product.getId()).orElseThrow().getQuantity()).isEqualTo(6);
        assertThat(movementCount(itemId)).isEqualTo(1);
        assertThat(soldPrice(itemId)).isEqualByComparingTo(new BigDecimal("15.00"));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void closeInvoice_saleExceedingStock_rollsBackEverything() {
        Product product = newProduct("Lifecycle Close Exceeding", 3);
        Invoice invoice = invoiceService.createInvoice(saleCommand(line(product, 5)));
        Long itemId = invoice.getItems().get(0).getId();

        assertThatThrownBy(() -> invoiceService.close(invoice.getId(), user))
                .isInstanceOf(InsufficientStockException.class)
                .hasMessageContaining("would result in negative stock");

        Invoice reloaded = invoiceRepository.findById(invoice.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(InvoiceStatus.OPEN);
        assertThat(reloaded.getClosedAt()).isNull();
        assertThat(movementCount(itemId)).isEqualTo(0);
        assertThat(productRepository.findById(product.getId()).orElseThrow().getQuantity()).isEqualTo(3);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void registerReturn_lastOutstandingItem_flipsInvoiceToFullyReturned() {
        Product product = newProduct("Lifecycle Full Return", 10);
        Invoice invoice = invoiceService.createInvoice(purchaseCommand(newSupplier(), line(product, 4)));
        invoiceService.close(invoice.getId(), user);

        invoiceService.registerReturn(invoice.getItems().get(0).getId(), 4);

        assertThat(invoiceRepository.findById(invoice.getId()).orElseThrow().getStatus())
                .isEqualTo(InvoiceStatus.FULLY_RETURNED);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void findDetailById_afterClose_mapsToResponseOutsideSession() {
        Product product = newProduct("Lifecycle Detail Fetch", 10);
        Invoice invoice = invoiceService.createInvoice(purchaseCommand(newSupplier(), line(product, 4)));
        invoiceService.close(invoice.getId(), user);

        Invoice detail = invoiceService.findDetailById(invoice.getId()).orElseThrow();

        // the method runs without a transaction, so the service's own one has closed by now: mapping here
        // touches associations with no session available and only survives because of the fetch join
        InvoiceResponse response = InvoiceResponse.from(detail);
        assertThat(response.supplierName()).isEqualTo("Acme");
        assertThat(response.items()).singleElement().satisfies(item -> {
            assertThat(item.productName()).isEqualTo("Lifecycle Detail Fetch");
            assertThat(item.quantity()).isEqualTo(4);
        });
    }
}
