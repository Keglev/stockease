package com.stocks.stockease.movement.web;

import com.stocks.stockease.movement.MovementReason;
import com.stocks.stockease.movement.RecordMovementCommand;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * Request body for returning units against an invoice line.
 *
 * <p>The product is named explicitly even though the invoice item already determines it. Deriving it
 * server-side would silently paper over a client that sent the wrong line; stating it lets the
 * service's item-product coherence check reject that mistake instead of bypassing it.
 *
 * @param invoiceItemId invoice line the units are returned against
 * @param productId product being returned, checked against the line's own product
 * @param reason which direction the return runs, from a customer or back to a supplier
 * @param quantity number of units returned; must be positive
 */
public record RegisterReturnRequest(
        @NotNull(message = "Invoice item is required.") Long invoiceItemId,
        @NotNull(message = "Product is required.") Long productId,
        @NotNull(message = "Movement reason is required.") MovementReason reason,
        @Positive(message = "Quantity must be positive.") int quantity) {

    /**
     * Maps this request to the command the movement service accepts.
     *
     * @return the equivalent movement command, never carrying a unit cost
     */
    public RecordMovementCommand toCommand() {
        return new RecordMovementCommand(productId, reason, quantity, invoiceItemId, null);
    }
}
