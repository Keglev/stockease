package com.stocks.stockease.movement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
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

    private User user;

    @BeforeEach
    void setUp() {
        // reused rather than re-inserted: the rollback test runs uncommitted-free, so its user outlives its method
        user = userRepository.findByUsername("movement-tester")
                .orElseGet(() -> userRepository.saveAndFlush(new User("movement-tester", "hash", "ROLE_ADMIN")));
    }

    /** Persists a product plus a sale invoice line of {@code itemQty} units at 15.00 each. */
    private InvoiceItem saleItemFor(Product product, int itemQty) {
        Invoice invoice = new Invoice();
        invoice.setType(InvoiceType.SALE);
        invoice.setStatus(InvoiceStatus.OPEN);
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
        invoice.setType(InvoiceType.PURCHASE);
        invoice.setSupplier(supplier);
        invoice.setStatus(InvoiceStatus.OPEN);
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
        Product product = productRepository.saveAndFlush(new Product("Widget", 10, 5.0));
        InvoiceItem item = saleItemFor(product, 5);

        StockMovement saved = stockMovementService
                .recordMovement(command(MovementReason.SOLD, product, 5, item.getId()), user);

        assertThat(productRepository.findById(product.getId()).orElseThrow().getQuantity()).isEqualTo(5);
        assertThat(stockMovementRepository.findById(saved.getId()).orElseThrow().getSoldPrice())
                .isEqualByComparingTo(new BigDecimal("15.00"));
        assertThat(saved.getReason()).isEqualTo(MovementReason.SOLD);
    }

    @Test
    void recordMovement_returnFromCustomer_incrementsReturnedQty() {
        Product product = productRepository.saveAndFlush(new Product("Widget", 10, 5.0));
        InvoiceItem item = saleItemFor(product, 5);
        stockMovementService.recordMovement(command(MovementReason.SOLD, product, 5, item.getId()), user);

        stockMovementService
                .recordMovement(command(MovementReason.RETURN_FROM_CUSTOMER, product, 2, item.getId()), user);

        assertThat(productRepository.findById(product.getId()).orElseThrow().getQuantity()).isEqualTo(7);
        assertThat(invoiceItemRepository.findById(item.getId()).orElseThrow().getReturnedQty()).isEqualTo(2);
    }

    @Test
    void recordMovement_decreaseBelowZero_rejectsAndRollsBack() {
        Product product = productRepository.saveAndFlush(new Product("Widget", 3, 5.0));
        InvoiceItem item = saleItemFor(product, 5);
        long movementsBefore = stockMovementRepository.count();

        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.SOLD, product, 5, item.getId()), user))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("would result in negative stock");

        assertThat(stockMovementRepository.count()).isEqualTo(movementsBefore);
        assertThat(product.getQuantity()).isEqualTo(3);
        assertThat(item.getReturnedQty()).isEqualTo(0);
    }

    /**
     * The one path that writes before it can fail: {@code registerReturn} raises {@code returnedQty} at step 5,
     * then the stock decrease is rejected at step 6, so the increment must roll back with it. Runs outside the
     * class-level test transaction, otherwise the rollback would be indistinguishable from a rolled-back test.
     */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void recordMovement_returnToSupplierExceedingStock_rollsBackReturnedQtyIncrement() {
        Product product = productRepository.saveAndFlush(new Product("Widget", 3, 5.0));
        InvoiceItem item = purchaseItemFor(product, 10);

        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.RETURNED_TO_SUPPLIER, product, 5, item.getId()), user))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("would result in negative stock");

        assertThat(invoiceItemRepository.findById(item.getId()).orElseThrow().getReturnedQty()).isEqualTo(0);
        assertThat(productRepository.findById(product.getId()).orElseThrow().getQuantity()).isEqualTo(3);
        assertThat(stockMovementRepository
                .existsByInvoiceItemIdAndReason(item.getId(), MovementReason.RETURNED_TO_SUPPLIER)).isFalse();
    }
}
