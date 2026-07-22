package com.stocks.stockease.audit.internal;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.audit.ProductChangeLog;

/** Spring Data JPA repository for {@link ProductChangeLog} entities. */
public interface ProductChangeLogRepository extends JpaRepository<ProductChangeLog, Long> {

    /**
     * Returns every change a user made, newest first.
     *
     * @param userId user identifier
     * @return that user's change log entries ordered by creation time descending
     */
    List<ProductChangeLog> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * Returns the full change history of one product, newest first.
     *
     * @param productId product identifier
     * @return that product's change log entries ordered by creation time descending
     */
    List<ProductChangeLog> findByProductIdOrderByCreatedAtDesc(Long productId);
}
