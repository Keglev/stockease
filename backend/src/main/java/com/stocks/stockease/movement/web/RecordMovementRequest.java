package com.stocks.stockease.movement.web;

import com.stocks.stockease.movement.MovementReason;
import com.stocks.stockease.movement.MovementRemark;
import com.stocks.stockease.movement.RecordMovementCommand;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * Request body for recording a standalone stock movement.
 *
 * <p>Carries no invoice link and no price: the only reasons this endpoint accepts are losses, which
 * stand on their own and consume no cost basis. Stock arrives exclusively through closed purchase
 * invoices (ADR 021), which is where every incoming price comes from.
 *
 * @param productId product whose stock changes
 * @param reason business reason for the change, which also fixes its direction; LOST or DESTROYED
 * @param quantity number of units affected; must be positive
 * @param remark why the stock was lost; required, since every reason this endpoint accepts is a loss
 */
public record RecordMovementRequest(
        @NotNull(message = "Product is required.") Long productId,
        @NotNull(message = "Movement reason is required.") MovementReason reason,
        @Positive(message = "Quantity must be positive.") int quantity,
        MovementRemark remark) {

    /**
     * Maps this request to the command the movement service accepts.
     *
     * @return the equivalent movement command, never referencing an invoice item or a price
     */
    public RecordMovementCommand toCommand() {
        return new RecordMovementCommand(productId, reason, quantity, null, null, remark);
    }
}
