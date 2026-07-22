package com.stocks.stockease.movement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;

import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceItem;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.movement.internal.StockMovementRepository;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;

import jakarta.persistence.EntityNotFoundException;

/** Tests for {@link StockMovementService} covering per-reason snapshots, deltas and every validation rule. */
@ExtendWith(MockitoExtension.class)
class StockMovementServiceTest {

    private static final long PRODUCT_ID = 1L;
    private static final long ITEM_ID = 7L;

    private StockMovementRepository stockMovementRepository;
    private ProductService productService;
    private InvoiceService invoiceService;
    private StockMovementService stockMovementService;
    private User user;

    @BeforeEach
    void setUp() {
        stockMovementRepository = mock(StockMovementRepository.class);
        productService = mock(ProductService.class);
        invoiceService = mock(InvoiceService.class);
        stockMovementService = new StockMovementService(stockMovementRepository, productService, invoiceService);
        user = new User("mover", "hash", "ROLE_ADMIN");
    }

    private static Product product() {
        Product product = new Product("Widget", 10, 5.0);
        product.setId(PRODUCT_ID);
        return product;
    }

    private static InvoiceItem item(InvoiceType type, int quantity) {
        Invoice invoice = new Invoice();
        invoice.setType(type);
        // movements are only bookable against a closed invoice; the open case is its own test
        invoice.setStatus(InvoiceStatus.CLOSED);
        InvoiceItem item = new InvoiceItem();
        item.setId(ITEM_ID);
        item.setInvoice(invoice);
        item.setProduct(product());
        item.setQuantity(quantity);
        item.setUnitPrice(new BigDecimal("15.00"));
        return item;
    }

    private static RecordMovementCommand command(MovementReason reason, int quantity, Long itemId, BigDecimal cost) {
        return new RecordMovementCommand(PRODUCT_ID, reason, quantity, itemId, cost);
    }

    /** Stubs the collaborators an invoice-linked movement needs and returns the linked item. */
    private InvoiceItem stubLinkedFlow(InvoiceType type, int quantity) {
        InvoiceItem item = item(type, quantity);
        when(invoiceService.findItemById(ITEM_ID)).thenReturn(Optional.of(item));
        when(productService.adjustQuantity(anyLong(), anyInt())).thenReturn(product());
        return item;
    }

    /** Captures the movement handed to the repository. */
    private StockMovement savedMovement() {
        ArgumentCaptor<StockMovement> captor = ArgumentCaptor.forClass(StockMovement.class);
        verify(stockMovementRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void recordMovement_newProduct_increasesStockAndSnapshotsSuppliedCost() {
        when(productService.adjustQuantity(anyLong(), anyInt())).thenReturn(product());

        stockMovementService.recordMovement(command(MovementReason.NEW_PRODUCT, 4, null, BigDecimal.TEN), user);

        verify(productService).adjustQuantity(PRODUCT_ID, 4);
        verify(invoiceService, never()).registerReturn(anyLong(), anyInt());
        StockMovement saved = savedMovement();
        assertThat(saved.getType()).isEqualTo(MovementType.INCREASE);
        assertThat(saved.getUnitCost()).isEqualByComparingTo(BigDecimal.TEN);
        assertThat(saved.getSoldPrice()).isNull();
        assertThat(saved.getInvoiceItem()).isNull();
    }

    @Test
    void recordMovement_purchase_increasesStockAndSnapshotsItemPriceAsCost() {
        InvoiceItem item = stubLinkedFlow(InvoiceType.PURCHASE, 5);

        stockMovementService.recordMovement(command(MovementReason.PURCHASE, 5, ITEM_ID, null), user);

        verify(productService).adjustQuantity(PRODUCT_ID, 5);
        verify(invoiceService, never()).registerReturn(anyLong(), anyInt());
        StockMovement saved = savedMovement();
        assertThat(saved.getType()).isEqualTo(MovementType.INCREASE);
        assertThat(saved.getUnitCost()).isEqualByComparingTo(item.getUnitPrice());
        assertThat(saved.getSoldPrice()).isNull();
        assertThat(saved.getInvoiceItem()).isSameAs(item);
    }

    @Test
    void recordMovement_sold_decreasesStockAndSnapshotsItemPriceAsSoldPrice() {
        InvoiceItem item = stubLinkedFlow(InvoiceType.SALE, 5);

        stockMovementService.recordMovement(command(MovementReason.SOLD, 5, ITEM_ID, null), user);

        verify(productService).adjustQuantity(PRODUCT_ID, -5);
        verify(invoiceService, never()).registerReturn(anyLong(), anyInt());
        StockMovement saved = savedMovement();
        assertThat(saved.getType()).isEqualTo(MovementType.DECREASE);
        assertThat(saved.getSoldPrice()).isEqualByComparingTo(item.getUnitPrice());
        assertThat(saved.getUnitCost()).isNull();
        assertThat(saved.getInvoiceItem()).isSameAs(item);
    }

    @Test
    void recordMovement_returnFromCustomer_increasesStockAndRegistersReturn() {
        InvoiceItem item = stubLinkedFlow(InvoiceType.SALE, 5);

        stockMovementService.recordMovement(command(MovementReason.RETURN_FROM_CUSTOMER, 2, ITEM_ID, null), user);

        verify(productService).adjustQuantity(PRODUCT_ID, 2);
        verify(invoiceService).registerReturn(ITEM_ID, 2);
        StockMovement saved = savedMovement();
        assertThat(saved.getType()).isEqualTo(MovementType.INCREASE);
        assertThat(saved.getSoldPrice()).isEqualByComparingTo(item.getUnitPrice());
        assertThat(saved.getUnitCost()).isNull();
    }

    @Test
    void recordMovement_returnedToSupplier_decreasesStockAndRegistersReturn() {
        stubLinkedFlow(InvoiceType.PURCHASE, 5);

        stockMovementService.recordMovement(command(MovementReason.RETURNED_TO_SUPPLIER, 2, ITEM_ID, null), user);

        verify(productService).adjustQuantity(PRODUCT_ID, -2);
        verify(invoiceService).registerReturn(ITEM_ID, 2);
        StockMovement saved = savedMovement();
        assertThat(saved.getType()).isEqualTo(MovementType.DECREASE);
        assertThat(saved.getSoldPrice()).isNull();
        assertThat(saved.getUnitCost()).isNull();
    }

    @Test
    void recordMovement_lost_decreasesStockWithoutSnapshotsOrInvoiceItem() {
        when(productService.adjustQuantity(anyLong(), anyInt())).thenReturn(product());

        stockMovementService.recordMovement(command(MovementReason.LOST, 3, null, null), user);

        verify(productService).adjustQuantity(PRODUCT_ID, -3);
        verify(invoiceService, never()).registerReturn(anyLong(), anyInt());
        StockMovement saved = savedMovement();
        assertThat(saved.getType()).isEqualTo(MovementType.DECREASE);
        assertThat(saved.getSoldPrice()).isNull();
        assertThat(saved.getUnitCost()).isNull();
        assertThat(saved.getInvoiceItem()).isNull();
    }

    @Test
    void recordMovement_destroyed_decreasesStockWithoutSnapshotsOrInvoiceItem() {
        when(productService.adjustQuantity(anyLong(), anyInt())).thenReturn(product());

        stockMovementService.recordMovement(command(MovementReason.DESTROYED, 1, null, null), user);

        verify(productService).adjustQuantity(PRODUCT_ID, -1);
        verify(invoiceService, never()).registerReturn(anyLong(), anyInt());
        StockMovement saved = savedMovement();
        assertThat(saved.getType()).isEqualTo(MovementType.DECREASE);
        assertThat(saved.getSoldPrice()).isNull();
        assertThat(saved.getUnitCost()).isNull();
        assertThat(saved.getInvoiceItem()).isNull();
    }

    @Test
    void recordMovement_withNullUser_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.LOST, 1, null, null), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("User is required.");
    }

    @Test
    void recordMovement_withNullReason_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> stockMovementService.recordMovement(command(null, 1, null, null), user))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Product and reason are required.");
    }

    @Test
    void recordMovement_withZeroQuantity_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.LOST, 0, null, null), user))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Quantity must be positive.");
    }

    @Test
    void recordMovement_newProductWithInvoiceItem_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.NEW_PRODUCT, 1, ITEM_ID, BigDecimal.TEN), user))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must not reference an invoice item");
    }

    @Test
    void recordMovement_newProductWithoutUnitCost_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.NEW_PRODUCT, 1, null, null), user))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("require a positive unit cost");
    }

    @Test
    void recordMovement_lostWithInvoiceItem_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.LOST, 1, ITEM_ID, null), user))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("carry no invoice item or prices");
    }

    @Test
    void recordMovement_purchaseWithoutInvoiceItem_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.PURCHASE, 1, null, null), user))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("PURCHASE movements require an invoice item.");
    }

    @Test
    void recordMovement_soldWithSuppliedUnitCost_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.SOLD, 1, ITEM_ID, BigDecimal.TEN), user))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("derived from the invoice item");
    }

    @Test
    void recordMovement_withMissingInvoiceItem_throwsEntityNotFoundException() {
        when(invoiceService.findItemById(ITEM_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.SOLD, 1, ITEM_ID, null), user))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Invoice item with ID 7 not found.");
    }

    @Test
    void recordMovement_soldAgainstPurchaseInvoice_throwsIllegalStateException() {
        when(invoiceService.findItemById(ITEM_ID)).thenReturn(Optional.of(item(InvoiceType.PURCHASE, 5)));

        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.SOLD, 5, ITEM_ID, null), user))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("SOLD movements must reference a SALE invoice item.");
    }

    @Test
    void recordMovement_soldAgainstOpenInvoice_throwsIllegalStateException() {
        InvoiceItem item = item(InvoiceType.SALE, 5);
        item.getInvoice().setStatus(InvoiceStatus.OPEN);
        when(invoiceService.findItemById(ITEM_ID)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.SOLD, 5, ITEM_ID, null), user))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Movements cannot be recorded against an open invoice.");
    }

    @Test
    void recordMovement_withInvoiceItemOfAnotherProduct_throwsIllegalStateException() {
        InvoiceItem item = item(InvoiceType.SALE, 5);
        item.getProduct().setId(99L);
        when(invoiceService.findItemById(ITEM_ID)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.SOLD, 5, ITEM_ID, null), user))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Invoice item 7 belongs to a different product.");
    }

    @Test
    void recordMovement_purchaseQuantityBelowItemQuantity_throwsIllegalStateException() {
        when(invoiceService.findItemById(ITEM_ID)).thenReturn(Optional.of(item(InvoiceType.PURCHASE, 5)));

        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.PURCHASE, 3, ITEM_ID, null), user))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Movement quantity must equal the invoice item quantity (5).");
    }

    @Test
    void recordMovement_soldAlreadyRecordedForItem_throwsIllegalStateException() {
        when(invoiceService.findItemById(ITEM_ID)).thenReturn(Optional.of(item(InvoiceType.SALE, 5)));
        when(stockMovementRepository.existsByInvoiceItemIdAndReason(ITEM_ID, MovementReason.SOLD)).thenReturn(true);

        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.SOLD, 5, ITEM_ID, null), user))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("A SOLD movement already exists for invoice item 7.");
    }

    @Test
    void recordMovement_withAnyReason_savesMovementForTriggeringUser() {
        when(productService.adjustQuantity(anyLong(), anyInt())).thenReturn(product());
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(call -> call.getArgument(0));

        StockMovement result = stockMovementService
                .recordMovement(command(MovementReason.LOST, 2, null, null), user);

        assertThat(result.getUser()).isSameAs(user);
        assertThat(result.getQuantity()).isEqualTo(2);
    }
}
