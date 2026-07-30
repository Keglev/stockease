package com.stocks.stockease.movement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceItem;
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.invoice.internal.InvoiceItemRepository;
import com.stocks.stockease.invoice.internal.InvoiceRepository;
import com.stocks.stockease.movement.internal.StockMovementRepository;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.internal.ProductRepository;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.shared.InsufficientStockException;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.internal.SupplierRepository;
import com.stocks.stockease.support.AbstractIntegrationTest;

/** Tests {@link StockMovementService} end to end against PostgreSQL, including the negative-stock rollback. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class StockMovementServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private StockMovementService stockMovementService;

    @Autowired
    private StockMovementRepository stockMovementRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceItemRepository invoiceItemRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User user;

    @BeforeEach
    void setUp() {
        // reused rather than re-inserted: the rollback test runs uncommitted-free, so its user outlives its method
        user = userRepository.findByUsername("movement-tester")
                .orElseGet(() -> userRepository.saveAndFlush(new User("movement-tester", "hash", "ROLE_ADMIN")));
    }

    /** invoice_number is NOT NULL and unique among live rows, so every fixture takes a fresh one. */
    private static final AtomicInteger NUMBERS = new AtomicInteger();

    private static String nextNumber() {
        return "TST-MOVE-INV-" + NUMBERS.incrementAndGet();
    }

    /** Persists a product plus a sale invoice line of {@code itemQty} units at 15.00 each. */
    private InvoiceItem saleItemFor(Product product, int itemQty) {
        Invoice invoice = new Invoice();
        invoice.setInvoiceNumber(nextNumber());
        invoice.setType(InvoiceType.SALE);
        // these fixtures stand in for already-booked invoices; movements are rejected against open ones
        invoice.setStatus(InvoiceStatus.CLOSED);
        invoice.setDueDate(LocalDate.now());
        invoice.setInterestRate(BigDecimal.ZERO);
        invoice.setFineValue(BigDecimal.ZERO);
        invoice = invoiceRepository.saveAndFlush(invoice);

        InvoiceItem item = new InvoiceItem();
        item.setInvoice(invoice);
        item.setProduct(product);
        item.setQuantity(itemQty);
        item.setUnitPrice(new BigDecimal("15.00"));
        item.setReturnedQty(0);
        return invoiceItemRepository.saveAndFlush(item);
    }

    /** Persists a supplier-backed purchase invoice line of {@code itemQty} units at 15.00 each. */
    private InvoiceItem purchaseItemFor(Product product, int itemQty) {
        Supplier supplier = supplierRepository.saveAndFlush(new Supplier(null, "Acme", "1 Main St", null, null));
        Invoice invoice = new Invoice();
        invoice.setInvoiceNumber(nextNumber());
        invoice.setType(InvoiceType.PURCHASE);
        invoice.setSupplier(supplier);
        // these fixtures stand in for already-booked invoices; movements are rejected against open ones
        invoice.setStatus(InvoiceStatus.CLOSED);
        invoice.setDueDate(LocalDate.now());
        invoice.setInterestRate(BigDecimal.ZERO);
        invoice.setFineValue(BigDecimal.ZERO);
        invoice = invoiceRepository.saveAndFlush(invoice);

        InvoiceItem item = new InvoiceItem();
        item.setInvoice(invoice);
        item.setProduct(product);
        item.setQuantity(itemQty);
        item.setUnitPrice(new BigDecimal("15.00"));
        item.setReturnedQty(0);
        return invoiceItemRepository.saveAndFlush(item);
    }

    private RecordMovementCommand command(MovementReason reason, Product product, int quantity, Long itemId) {
        return new RecordMovementCommand(product.getId(), reason, quantity, itemId, null);
    }

    @Test
    void recordMovement_soldAgainstSaleInvoice_decreasesStockAndSnapshotsPrice() {
        Product product = productRepository.saveAndFlush(
                withSku(new Product("Movement Sold", 10, 5.0), "TST-MOVE-1"));
        InvoiceItem item = saleItemFor(product, 5);

        StockMovement saved = stockMovementService
                .recordMovement(command(MovementReason.SOLD, product, 5, item.getId()), user);

        assertThat(productRepository.findById(product.getId()).orElseThrow().getQuantity()).isEqualTo(5);
        assertThat(stockMovementRepository.findById(saved.getId()).orElseThrow().getSoldPrice())
                .isEqualByComparingTo(new BigDecimal("15.00"));
        assertThat(saved.getReason()).isEqualTo(MovementReason.SOLD);
    }

    @Test
    void recordMovement_sold_capturesProductPurchasePriceAsUnitCost() {
        Product product = productRepository.saveAndFlush(
                withSku(new Product("Movement Sold Cost", 10, 50.0), "TST-MOVE-COGS-1"));
        InvoiceItem item = saleItemFor(product, 4);

        StockMovement saved = stockMovementService
                .recordMovement(command(MovementReason.SOLD, product, 4, item.getId()), user);

        // both halves of the margin are pinned to the moment of sale: what it earned and what it cost
        assertThat(saved.getUnitCost()).isEqualByComparingTo(new BigDecimal("50.00"));
        assertThat(saved.getSoldPrice()).isEqualByComparingTo(new BigDecimal("15.00"));
    }

    @Test
    void recordMovement_returnAfterPriceChange_copiesSaleUnitCostNotCurrent() {
        Product product = productRepository.saveAndFlush(
                withSku(new Product("Movement Return Cost", 10, 50.0), "TST-MOVE-COGS-2"));
        InvoiceItem item = saleItemFor(product, 4);
        stockMovementService.recordMovement(command(MovementReason.SOLD, product, 4, item.getId()), user);
        product.setPurchasePrice(new BigDecimal("70.00"));
        productRepository.saveAndFlush(product);

        StockMovement returned = stockMovementService
                .recordMovement(command(MovementReason.RETURN_FROM_CUSTOMER, product, 1, item.getId()), user);

        // 50.00, not today's 70.00: a reversal has to cancel exactly what the sale booked, or the
        // price change would leave a residue in gross profit
        assertThat(returned.getUnitCost()).isEqualByComparingTo(new BigDecimal("50.00"));
    }

    @Test
    void recordMovement_purchase_flipsEverStockedOnce() {
        Product product = productRepository.saveAndFlush(
                withSku(new Product("Movement Ever Stocked", 0, 5.0), "TST-MOVE-EVER-1"));
        InvoiceItem first = purchaseItemFor(product, 6);
        InvoiceItem second = purchaseItemFor(product, 4);

        stockMovementService.recordMovement(command(MovementReason.PURCHASE, product, 6, first.getId()), user);
        assertThat(productRepository.findById(product.getId()).orElseThrow().isEverStocked()).isTrue();

        stockMovementService.recordMovement(command(MovementReason.PURCHASE, product, 4, second.getId()), user);

        assertThat(productRepository.findById(product.getId()).orElseThrow().isEverStocked()).isTrue();
        // the flip is derived state, not an operator edit, so neither purchase may leave an audit row -
        // and a second flip would be the one thing that could produce one
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM product_change_log WHERE product_id = ?", Long.class, product.getId()))
                .isZero();
    }

    @Test
    void recordMovement_lossOnUnstockedProduct_neverFlips() {
        // stock rules make this near-unreachable with real data - a product at zero cannot lose units -
        // so the fixture starts it stocked without a purchase, to isolate what the reason alone does
        Product product = productRepository.saveAndFlush(
                withSku(new Product("Movement Loss No Flip", 5, 5.0), "TST-MOVE-EVER-2"));

        stockMovementService.recordMovement(
                new RecordMovementCommand(product.getId(), MovementReason.LOST, 2, null, null,
                        MovementRemark.IN_TRANSIT_TO_CUSTOMER),
                user);

        Product reloaded = productRepository.findById(product.getId()).orElseThrow();
        assertThat(reloaded.getQuantity()).isEqualTo(3);
        assertThat(reloaded.isEverStocked()).isFalse();
    }

    @Test
    void recordMovement_returnFromCustomer_incrementsReturnedQty() {
        Product product = productRepository.saveAndFlush(
                withSku(new Product("Movement Return From Customer", 10, 5.0), "TST-MOVE-2"));
        InvoiceItem item = saleItemFor(product, 5);
        stockMovementService.recordMovement(command(MovementReason.SOLD, product, 5, item.getId()), user);

        stockMovementService
                .recordMovement(command(MovementReason.RETURN_FROM_CUSTOMER, product, 2, item.getId()), user);

        assertThat(productRepository.findById(product.getId()).orElseThrow().getQuantity()).isEqualTo(7);
        assertThat(invoiceItemRepository.findById(item.getId()).orElseThrow().getReturnedQty()).isEqualTo(2);
    }

    /** Runs outside the class-level test transaction so the reloads below observe committed state, not the session. */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void recordMovement_decreaseBelowZero_rejectsAndRollsBack() {
        Product product = productRepository.saveAndFlush(
                withSku(new Product("Movement Below Zero", 3, 5.0), "TST-MOVE-3"));
        InvoiceItem item = saleItemFor(product, 5);
        long movementsBefore = stockMovementRepository.count();

        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.SOLD, product, 5, item.getId()), user))
                .isInstanceOf(InsufficientStockException.class)
                .hasMessageContaining("would result in negative stock");

        assertThat(stockMovementRepository.count()).isEqualTo(movementsBefore);
        assertThat(productRepository.findById(product.getId()).orElseThrow().getQuantity()).isEqualTo(3);
        assertThat(invoiceItemRepository.findById(item.getId()).orElseThrow().getReturnedQty()).isEqualTo(0);
    }

    /**
     * The one path that writes before it can fail: {@code registerReturn} raises {@code returnedQty} at step 5,
     * then the stock decrease is rejected at step 6, so the increment must roll back with it. Runs outside the
     * class-level test transaction, otherwise the rollback would be indistinguishable from a rolled-back test.
     */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void recordMovement_returnToSupplierExceedingStock_rollsBackReturnedQtyIncrement() {
        Product product = productRepository.saveAndFlush(
                withSku(new Product("Movement Return To Supplier", 3, 5.0), "TST-MOVE-4"));
        InvoiceItem item = purchaseItemFor(product, 10);

        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.RETURNED_TO_SUPPLIER, product, 5, item.getId()), user))
                .isInstanceOf(InsufficientStockException.class)
                .hasMessageContaining("would result in negative stock");

        assertThat(invoiceItemRepository.findById(item.getId()).orElseThrow().getReturnedQty()).isEqualTo(0);
        assertThat(productRepository.findById(product.getId()).orElseThrow().getQuantity()).isEqualTo(3);
        assertThat(stockMovementRepository
                .existsByInvoiceItemIdAndReason(item.getId(), MovementReason.RETURNED_TO_SUPPLIER)).isFalse();
    }

    @Test
    void insertMovement_lostWithoutRemarkViaRawSql_isRejectedByTheCheckConstraint() {
        Product product = productRepository.saveAndFlush(
                withSku(new Product("Movement Check Missing", 10, 5.0), "TST-MOVE-5"));

        // straight past the service, because the point is that the database refuses it on its own
        assertThatThrownBy(() -> insertMovement(product, "LOST", null))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("chk_movement_remark");
    }

    @Test
    void insertMovement_soldCarryingARemarkViaRawSql_isRejectedByTheCheckConstraint() {
        Product product = productRepository.saveAndFlush(
                withSku(new Product("Movement Check Extra", 10, 5.0), "TST-MOVE-6"));

        // the other half of the boolean equality: a reason that is not a loss must carry no remark
        assertThatThrownBy(() -> insertMovement(product, "SOLD", "EXPIRED"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("chk_movement_remark");
    }

    /** Inserts a movement row directly, bypassing every Java-side rule. */
    private void insertMovement(Product product, String reason, String remark) {
        jdbcTemplate.update(
                "INSERT INTO stock_movement (product_id, user_id, type, reason, quantity, created_at, "
                        + "movement_remark) VALUES (?, ?, 'DECREASE', ?, 1, now(), ?)",
                product.getId(), user.getId(), reason, remark);
    }

    /** The SKU is no longer generated on persist, so every fixture has to carry its own. */
    private static Product withSku(Product product, String sku) {
        product.setSku(sku);
        return product;
    }
}
