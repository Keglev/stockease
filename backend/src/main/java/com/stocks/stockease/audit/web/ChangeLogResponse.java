package com.stocks.stockease.audit.web;

import java.time.LocalDateTime;

import com.stocks.stockease.audit.ChangedField;
import com.stocks.stockease.audit.ProductChangeLog;

/**
 * API representation of a single product change log entry.
 *
 * <p>The product and user appear as identifiers only: reading an identifier off a lazy association
 * touches the proxy's key rather than loading the row, so a page of history costs one query.
 *
 * @param id unique change log entry identifier
 * @param productId product the change was made to
 * @param userId user who made the change
 * @param field attribute that changed
 * @param oldValue value before the change, {@code null} for lifecycle events carrying no value
 * @param newValue value after the change, {@code null} for lifecycle events carrying no value
 * @param createdAt moment the change was recorded
 */
public record ChangeLogResponse(Long id, Long productId, Long userId, ChangedField field, String oldValue,
        String newValue, LocalDateTime createdAt) {

    /**
     * Maps a change log entry to its API representation without initializing any association.
     *
     * @param log the entity to map
     * @return the change log record
     */
    public static ChangeLogResponse from(ProductChangeLog log) {
        return new ChangeLogResponse(log.getId(), log.getProduct().getId(), log.getUser().getId(), log.getField(),
                log.getOldValue(), log.getNewValue(), log.getCreatedAt());
    }
}
