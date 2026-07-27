package com.stocks.stockease.movement.web;

import java.math.BigDecimal;

import com.stocks.stockease.movement.MovementReason;
import com.stocks.stockease.movement.RecordMovementCommand;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * Request body for recording a standalone stock movement.
 *
 * <p>Carries no invoice link: the reasons this endpoint accepts are corrections that stand on their
 * own, so the command it maps to always has a {@code null} invoice item.
 *
 * @param productId product whose stock changes
 * @param reason business reason for the change, which also fixes its direction
 * @param quantity number of units affected; must be positive
 * @param unitCost cost snapshot per unit, required by {@code NEW_PRODUCT} and rejected for other reasons
 */
public record RecordMovementRequest(
        @NotNull(message = "Product is required.") Long productId,
        @NotNull(message = "Movement reason is required.") MovementReason reason,
        @Positive(message = "Quantity must be positive.") int quantity,
        @Positive(message = "Unit cost must be positive.") BigDecimal unitCost) {

    /**
     * Maps this request to the command the movement service accepts.
     *
     * @return the equivalent movement command, never referencing an invoice item
     */
    public RecordMovementCommand toCommand() {
        return new RecordMovementCommand(productId, reason, quantity, null, unitCost);
    }
}
