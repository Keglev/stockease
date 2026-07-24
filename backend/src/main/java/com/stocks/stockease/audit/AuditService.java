package com.stocks.stockease.audit;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.audit.internal.ProductChangeLogRepository;

import lombok.RequiredArgsConstructor;

/**
 * Read side of the product change log; the write side is the event listener that records changes
 * as they happen. Other modules depend on this service rather than reaching into the repository.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuditService {

    private final ProductChangeLogRepository productChangeLogRepository;

    /**
     * Returns every product change a user made, newest first.
     *
     * @param userId user identifier
     * @return that user's change log entries ordered by creation time descending
     */
    public List<ProductChangeLog> findChangesByUser(long userId) {
        return productChangeLogRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    /**
     * Returns the full change history of one product, newest first.
     *
     * @param productId product identifier
     * @return that product's change log entries ordered by creation time descending
     */
    public List<ProductChangeLog> findChangesByProduct(long productId) {
        return productChangeLogRepository.findByProductIdOrderByCreatedAtDesc(productId);
    }
}
