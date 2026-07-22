package com.stocks.stockease.movement.internal;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.movement.MovementReason;
import com.stocks.stockease.movement.StockMovement;

/** Spring Data JPA repository for {@link StockMovement} entities. */
public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {

    /**
     * Reports whether a movement with the given reason already exists for an invoice item,
     * used to keep a purchase or sale from being recorded twice against the same line.
     *
     * @param invoiceItemId invoice item identifier
     * @param reason movement reason to look for
     * @return {@code true} if such a movement already exists
     */
    boolean existsByInvoiceItemIdAndReason(Long invoiceItemId, MovementReason reason);

    /**
     * Returns every movement a user triggered, newest first.
     *
     * @param userId user identifier
     * @return that user's movements ordered by creation time descending
     */
    List<StockMovement> findByUserIdOrderByCreatedAtDesc(Long userId);
}
