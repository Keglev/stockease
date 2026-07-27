package com.stocks.stockease.movement.web;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.stocks.stockease.movement.MovementReason;
import com.stocks.stockease.movement.MovementType;
import com.stocks.stockease.movement.StockMovement;

/**
 * API representation of a recorded stock movement.
 *
 * <p>Every association appears as an identifier only: reading an identifier off a lazy association
 * touches the proxy's key rather than loading the row, so this record is safe to build from a movement
 * whose product, user and invoice line were never initialized.
 *
 * @param id unique movement identifier
 * @param productId product whose stock changed
 * @param userId user who triggered the movement
 * @param type direction of the change
 * @param reason business reason for the change
 * @param quantity number of units affected
 * @param invoiceItemId invoice line this movement fulfils, or {@code null} where no link applies
 * @param soldPrice revenue snapshot per unit, set only for sales and customer returns
 * @param unitCost cost snapshot per unit, set only for initial stock and purchases
 * @param createdAt moment the movement was recorded
 */
public record MovementResponse(Long id, Long productId, Long userId, MovementType type, MovementReason reason,
        Integer quantity, Long invoiceItemId, BigDecimal soldPrice, BigDecimal unitCost, LocalDateTime createdAt) {

    /**
     * Maps a recorded movement to its API representation without initializing any association.
     *
     * @param movement the entity to map
     * @return the movement record
     */
    public static MovementResponse from(StockMovement movement) {
        return new MovementResponse(movement.getId(), movement.getProduct().getId(), movement.getUser().getId(),
                movement.getType(), movement.getReason(), movement.getQuantity(),
                movement.getInvoiceItem() == null ? null : movement.getInvoiceItem().getId(),
                movement.getSoldPrice(), movement.getUnitCost(), movement.getCreatedAt());
    }
}
