package com.stocks.stockease.movement.internal;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import com.stocks.stockease.invoice.InvoiceClosedEvent;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.movement.MovementReason;
import com.stocks.stockease.movement.RecordMovementCommand;
import com.stocks.stockease.movement.StockMovementService;

import lombok.RequiredArgsConstructor;

/**
 * Books one stock movement per line when an invoice is closed.
 * Deliberately a synchronous {@code @EventListener}, NOT {@code @ApplicationModuleListener} - the async
 * variant runs after commit, which would let a close succeed while its stock booking fails.
 */
@Component
@RequiredArgsConstructor
public class InvoiceClosedListener {

    private final StockMovementService stockMovementService;

    /**
     * Records the stock movement each closed line implies.
     *
     * @param event the close that was published inside the closing transaction
     */
    @EventListener
    public void onInvoiceClosed(InvoiceClosedEvent event) {
        MovementReason reason = event.type() == InvoiceType.PURCHASE ? MovementReason.PURCHASE : MovementReason.SOLD;
        for (InvoiceClosedEvent.Line line : event.lines()) {
            stockMovementService.recordMovement(
                    new RecordMovementCommand(line.productId(), reason, line.quantity(), line.invoiceItemId(), null),
                    event.closedBy());
        }
    }
}
