package com.stocks.stockease.movement;

import static com.stocks.stockease.movement.MovementTestFixtures.ITEM_ID;
import static com.stocks.stockease.movement.MovementTestFixtures.PRODUCT_ID;
import static com.stocks.stockease.movement.MovementTestFixtures.command;
import static com.stocks.stockease.movement.MovementTestFixtures.item;
import static com.stocks.stockease.movement.MovementTestFixtures.product;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;

import com.stocks.stockease.invoice.InvoiceItem;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.movement.internal.StockMovementRepository;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;

/*
 * Contract: what a movement DOES once it is allowed - which way stock moves, which prices the
 * movement snapshots, whether it registers a return against the invoice line, and who it is
 * booked to.
 *
 * One reason per test, because the reason is the whole rule: it alone decides the direction and
 * which of unitCost and soldPrice is filled. The snapshots are the point rather than a detail -
 * a movement records what a unit was worth when it moved, so later reports do not re-read a
 * price that has since changed (ADR 019, ADR 024).
 *
 * Out of scope: whether a movement is allowed at all. Every guard - required fields, the
 * remark rules, the invoice-line checks - is specified in StockMovementValidationServiceTest.
 */
@ExtendWith(MockitoExtension.class)
class StockMovementFlowServiceTest {

    private MovementTestFixtures fixtures;
    private StockMovementRepository stockMovementRepository;
    private ProductService productService;
    private InvoiceService invoiceService;
    private StockMovementService stockMovementService;
    private User user;

    @BeforeEach
    void setUp() {
        fixtures = new MovementTestFixtures();
        stockMovementRepository = fixtures.stockMovementRepository;
        productService = fixtures.productService;
        invoiceService = fixtures.invoiceService;
        stockMovementService = fixtures.stockMovementService;
        user = fixtures.user;
    }

    /** Stubs the collaborators an invoice-linked movement needs and returns the linked item. */
    private InvoiceItem stubLinkedFlow(InvoiceType type, int quantity) {
        InvoiceItem item = item(type, quantity);
        when(invoiceService.findItemById(ITEM_ID)).thenReturn(Optional.of(item));
        when(productService.adjustQuantity(anyLong(), anyInt())).thenReturn(product());
        return item;
    }

    /**
     * Stubs the product as live. Returns are refused when their product is soft-deleted (ADR 033),
     * and the guard asks the product service, so a return test has to say the product still exists.
     */
    private void stubLiveProduct() {
        when(productService.findById(PRODUCT_ID)).thenReturn(Optional.of(product()));
    }

    /** Stubs the SOLD movement a customer return reads its cost from. */
    private void stubSaleMovement(BigDecimal unitCost) {
        StockMovement sale = new StockMovement();
        sale.setUnitCost(unitCost);
        when(stockMovementRepository.findFirstByInvoiceItemIdAndReason(ITEM_ID, MovementReason.SOLD))
                .thenReturn(Optional.of(sale));
    }

    /** Captures the movement handed to the repository. */
    private StockMovement savedMovement() {
        ArgumentCaptor<StockMovement> captor = ArgumentCaptor.forClass(StockMovement.class);
        verify(stockMovementRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void findByUser_withMovements_returnsRepositoryResult() {
        StockMovement movement = new StockMovement();
        when(stockMovementRepository.findByUserIdOrderByCreatedAtDesc(3L)).thenReturn(List.of(movement));

        assertThat(stockMovementService.findByUser(3L)).containsExactly(movement);
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
        // the sale's COGS snapshot: the product's purchase price at this moment, not the sale price
        assertThat(saved.getUnitCost()).isEqualByComparingTo(new BigDecimal("5.00"));
        assertThat(saved.getInvoiceItem()).isSameAs(item);
    }

    @Test
    void recordMovement_returnFromCustomer_increasesStockAndRegistersReturn() {
        InvoiceItem item = stubLinkedFlow(InvoiceType.SALE, 5);
        stubSaleMovement(new BigDecimal("5.00"));
        stubLiveProduct();

        stockMovementService.recordMovement(command(MovementReason.RETURN_FROM_CUSTOMER, 2, ITEM_ID, null), user);

        verify(productService).adjustQuantity(PRODUCT_ID, 2);
        verify(invoiceService).registerReturn(ITEM_ID, 2);
        StockMovement saved = savedMovement();
        assertThat(saved.getType()).isEqualTo(MovementType.INCREASE);
        assertThat(saved.getSoldPrice()).isEqualByComparingTo(item.getUnitPrice());
        // copied from the sale rather than re-read from the product, so the reversal is exact
        assertThat(saved.getUnitCost()).isEqualByComparingTo(new BigDecimal("5.00"));
    }

    @Test
    void recordMovement_returnedToSupplier_decreasesStockAndRegistersReturn() {
        stubLinkedFlow(InvoiceType.PURCHASE, 5);
        stubLiveProduct();

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
    void recordMovement_lostWithRemark_persistsTheRemarkOnTheMovement() {
        when(productService.adjustQuantity(anyLong(), anyInt())).thenReturn(product());

        stockMovementService.recordMovement(command(MovementReason.LOST, MovementRemark.EXPIRED), user);

        assertThat(savedMovement().getRemark()).isEqualTo(MovementRemark.EXPIRED);
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
    void recordMovement_withAnyReason_savesMovementForTriggeringUser() {
        when(productService.adjustQuantity(anyLong(), anyInt())).thenReturn(product());
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(call -> call.getArgument(0));

        StockMovement result = stockMovementService
                .recordMovement(command(MovementReason.LOST, 2, null, null), user);

        assertThat(result.getUser()).isSameAs(user);
        assertThat(result.getQuantity()).isEqualTo(2);
    }
}
