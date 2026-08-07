package com.stocks.stockease.movement;

import static com.stocks.stockease.movement.MovementTestFixtures.ITEM_ID;
import static com.stocks.stockease.movement.MovementTestFixtures.PRODUCT_ID;
import static com.stocks.stockease.movement.MovementTestFixtures.command;
import static com.stocks.stockease.movement.MovementTestFixtures.item;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import com.stocks.stockease.invoice.InvoiceItem;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.movement.internal.StockMovementRepository;
import com.stocks.stockease.security.User;
import com.stocks.stockease.shared.InvalidMovementException;

import jakarta.persistence.EntityNotFoundException;

/*
 * Contract: which movements are refused, and with which message. Every test here asserts that
 * nothing was booked - the refusal is the behaviour.
 *
 * The guards fall into three sets: the fields a command must carry at all, the remark rules
 * (a remark explains a loss, so it is mandatory for LOST and DESTROYED and forbidden elsewhere),
 * and the invoice-line checks, which are the strictest because a movement against the wrong,
 * open, foreign or already-booked line would corrupt stock in a way no later edit can undo.
 * Messages are asserted verbatim: they reach an operator who has to know what to fix.
 *
 * Out of scope: what a permitted movement does to stock and which prices it snapshots. Those
 * effects are specified in StockMovementFlowServiceTest.
 */
@ExtendWith(MockitoExtension.class)
class StockMovementValidationServiceTest {

    private MovementTestFixtures fixtures;
    private StockMovementRepository stockMovementRepository;
    private InvoiceService invoiceService;
    private StockMovementService stockMovementService;
    private User user;

    @BeforeEach
    void setUp() {
        fixtures = new MovementTestFixtures();
        stockMovementRepository = fixtures.stockMovementRepository;
        invoiceService = fixtures.invoiceService;
        stockMovementService = fixtures.stockMovementService;
        user = fixtures.user;
    }

    @Test
    void recordMovement_lostWithoutRemark_throwsInvalidMovementException() {
        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.LOST, (MovementRemark) null), user))
                .isInstanceOf(InvalidMovementException.class)
                .hasMessage("LOST and DESTROYED movements require a remark.");
    }

    @Test
    void recordMovement_destroyedWithoutRemark_throwsInvalidMovementException() {
        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.DESTROYED, (MovementRemark) null), user))
                .isInstanceOf(InvalidMovementException.class)
                .hasMessage("LOST and DESTROYED movements require a remark.");
    }

    @Test
    void recordMovement_purchaseWithRemark_throwsInvalidMovementException() {
        RecordMovementCommand command = new RecordMovementCommand(
                PRODUCT_ID, MovementReason.PURCHASE, 2, ITEM_ID, null, MovementRemark.EXPIRED);

        assertThatThrownBy(() -> stockMovementService.recordMovement(command, user))
                .isInstanceOf(InvalidMovementException.class)
                .hasMessageContaining("A remark explains a loss");
    }

    @Test
    void recordMovement_withNullUser_throwsInvalidMovementException() {
        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.LOST, 1, null, null), null))
                .isInstanceOf(InvalidMovementException.class)
                .hasMessage("User is required.");
    }

    @Test
    void recordMovement_withNullReason_throwsInvalidMovementException() {
        assertThatThrownBy(() -> stockMovementService.recordMovement(command(null, 1, null, null), user))
                .isInstanceOf(InvalidMovementException.class)
                .hasMessage("Product and reason are required.");
    }

    @Test
    void recordMovement_withZeroQuantity_throwsInvalidMovementException() {
        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.LOST, 0, null, null), user))
                .isInstanceOf(InvalidMovementException.class)
                .hasMessage("Quantity must be positive.");
    }

    @Test
    void recordMovement_lostWithUnitCost_throwsInvalidMovementException() {
        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.LOST, 1, null, BigDecimal.TEN), user))
                .isInstanceOf(InvalidMovementException.class)
                .hasMessageContaining("carry no invoice item or prices");
    }

    @Test
    void recordMovement_lostWithInvoiceItem_throwsInvalidMovementException() {
        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.LOST, 1, ITEM_ID, null), user))
                .isInstanceOf(InvalidMovementException.class)
                .hasMessageContaining("carry no invoice item or prices");
    }

    @Test
    void recordMovement_purchaseWithoutInvoiceItem_throwsInvalidMovementException() {
        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.PURCHASE, 1, null, null), user))
                .isInstanceOf(InvalidMovementException.class)
                .hasMessage("PURCHASE movements require an invoice item.");
    }

    @Test
    void recordMovement_soldWithSuppliedUnitCost_throwsInvalidMovementException() {
        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.SOLD, 1, ITEM_ID, BigDecimal.TEN), user))
                .isInstanceOf(InvalidMovementException.class)
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
    void recordMovement_soldAgainstPurchaseInvoice_throwsInvalidMovementException() {
        when(invoiceService.findItemById(ITEM_ID)).thenReturn(Optional.of(item(InvoiceType.PURCHASE, 5)));

        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.SOLD, 5, ITEM_ID, null), user))
                .isInstanceOf(InvalidMovementException.class)
                .hasMessage("SOLD movements must reference a SALE invoice item.");
    }

    @Test
    void recordMovement_soldAgainstOpenInvoice_throwsInvalidMovementException() {
        InvoiceItem item = item(InvoiceType.SALE, 5);
        item.getInvoice().setStatus(InvoiceStatus.OPEN);
        when(invoiceService.findItemById(ITEM_ID)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.SOLD, 5, ITEM_ID, null), user))
                .isInstanceOf(InvalidMovementException.class)
                .hasMessage("Movements cannot be recorded against an open invoice.");
    }

    @Test
    void recordMovement_withInvoiceItemOfAnotherProduct_throwsInvalidMovementException() {
        InvoiceItem item = item(InvoiceType.SALE, 5);
        // the service compares the line's foreign-key scalar, not the association (ADR 033)
        item.setProductId(99L);
        when(invoiceService.findItemById(ITEM_ID)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.SOLD, 5, ITEM_ID, null), user))
                .isInstanceOf(InvalidMovementException.class)
                .hasMessage("Invoice item 7 belongs to a different product.");
    }

    @Test
    void recordMovement_purchaseQuantityBelowItemQuantity_throwsInvalidMovementException() {
        when(invoiceService.findItemById(ITEM_ID)).thenReturn(Optional.of(item(InvoiceType.PURCHASE, 5)));

        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.PURCHASE, 3, ITEM_ID, null), user))
                .isInstanceOf(InvalidMovementException.class)
                .hasMessage("Movement quantity must equal the invoice item quantity (5).");
    }

    @Test
    void recordMovement_soldAlreadyRecordedForItem_throwsInvalidMovementException() {
        when(invoiceService.findItemById(ITEM_ID)).thenReturn(Optional.of(item(InvoiceType.SALE, 5)));
        when(stockMovementRepository.existsByInvoiceItemIdAndReason(ITEM_ID, MovementReason.SOLD)).thenReturn(true);

        assertThatThrownBy(() -> stockMovementService
                .recordMovement(command(MovementReason.SOLD, 5, ITEM_ID, null), user))
                .isInstanceOf(InvalidMovementException.class)
                .hasMessage("A SOLD movement already exists for invoice item 7.");
    }
}
