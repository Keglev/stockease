package com.stocks.stockease.movement.internal;

import java.util.List;
import java.util.Optional;

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

    /**
     * Finds the movement of the given reason recorded against an invoice line, used by a customer
     * return to read the cost its own sale captured.
     *
     * @param invoiceItemId invoice item identifier
     * @param reason movement reason to look for
     * @return that movement, or empty when the line carries none
     */
    Optional<StockMovement> findFirstByInvoiceItemIdAndReason(Long invoiceItemId, MovementReason reason);
}
