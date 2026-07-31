package com.stocks.stockease.audit;

import java.time.LocalDateTime;

/**
 * One change-log row enriched with the names behind its foreign keys, for the changes report.
 *
 * <p>A second DTO beside {@link com.stocks.stockease.audit.web.ChangeLogResponse} rather than a widening of it. That one carries
 * bare {@code productId} and {@code userId} and is pinned by the per-user and per-product listings
 * its consumers already read; a report that renders "who changed what" needs the username and the
 * product's identity, and nothing about those consumers wants the extra columns.
 *
 * <p>A soft-deleted product keeps appearing here, flagged, as in every report: the change it records
 * was really made, and retiring the product afterwards does not unmake it.
 *
 * @param id change log entry identifier
 * @param productId product the change was made to
 * @param productName that product's name
 * @param sku that product's stock keeping unit
 * @param productDeleted whether the product has since been soft-deleted
 * @param username the account that made the change
 * @param field attribute that changed
 * @param oldValue value before the change; {@code null} for lifecycle events that carry no value
 * @param newValue value after the change; {@code null} for lifecycle events that carry no value
 * @param createdAt when the change was recorded
 */
public record ChangeLogEntryResponse(Long id, Long productId, String productName, String sku,
        boolean productDeleted, String username, ChangedField field, String oldValue, String newValue,
        LocalDateTime createdAt) {
}
