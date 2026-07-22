package com.stocks.stockease.movement;

import java.math.BigDecimal;

/**
 * Request to record a stock movement; {@code unitCost} is accepted only for {@code NEW_PRODUCT}
 * and {@code invoiceItemId} only for the reasons that require an invoice link.
 *
 * @param productId product whose stock changes
 * @param reason business reason for the change, which also fixes its direction
 * @param quantity number of units affected; must be positive
 * @param invoiceItemId invoice line this movement fulfils, or {@code null} where no link applies
 * @param unitCost cost snapshot per unit for initial stock, or {@code null} for every other reason
 */
public record RecordMovementCommand(Long productId, MovementReason reason, int quantity, Long invoiceItemId,
        BigDecimal unitCost) {
}
