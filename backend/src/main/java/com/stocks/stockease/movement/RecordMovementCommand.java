package com.stocks.stockease.movement;

import java.math.BigDecimal;

/**
 * Request to record a stock movement; {@code unitCost} is accepted only for {@code NEW_PRODUCT},
 * {@code invoiceItemId} only for the reasons that require an invoice link, and {@code remark} only
 * for {@code LOST} and {@code DESTROYED}, which require it.
 *
 * @param productId product whose stock changes
 * @param reason business reason for the change, which also fixes its direction
 * @param quantity number of units affected; must be positive
 * @param invoiceItemId invoice line this movement fulfils, or {@code null} where no link applies
 * @param unitCost cost snapshot per unit for initial stock, or {@code null} for every other reason
 * @param remark why the stock was lost, required by {@code LOST} and {@code DESTROYED} and
 *        {@code null} for every other reason
 */
public record RecordMovementCommand(Long productId, MovementReason reason, int quantity, Long invoiceItemId,
        BigDecimal unitCost, MovementRemark remark) {

    /**
     * Creates a command for a movement that carries no remark, which is every reason but
     * {@code LOST} and {@code DESTROYED}.
     *
     * @param productId product whose stock changes
     * @param reason business reason for the change
     * @param quantity number of units affected
     * @param invoiceItemId invoice line this movement fulfils, or {@code null}
     * @param unitCost cost snapshot per unit, or {@code null}
     */
    public RecordMovementCommand(Long productId, MovementReason reason, int quantity, Long invoiceItemId,
            BigDecimal unitCost) {
        this(productId, reason, quantity, invoiceItemId, unitCost, null);
    }
}
