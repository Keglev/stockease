package com.stocks.stockease.product;

import com.stocks.stockease.security.User;

/**
 * Published when a product attribute changes or its soft-delete state flips; the nested {@link Field}
 * enum deliberately mirrors the audit module's {@code ChangedField} by name so the product module never
 * depends on an audit type, which would create a module cycle.
 *
 * @param product the product that changed
 * @param user user who made the change
 * @param field which attribute or lifecycle event this records
 * @param oldValue value before the change; {@code null} for lifecycle events
 * @param newValue value after the change; {@code null} for lifecycle events
 */
public record ProductChangedEvent(Product product, User user, Field field, String oldValue, String newValue) {

    /** Attributes and lifecycle events worth recording; names match the audit module's enum constants. */
    public enum Field {
        NAME,
        PURCHASE_PRICE,

        /** Soft delete lifecycle event, values are null. */
        DELETED,

        /** Soft delete lifecycle event, values are null. */
        RESTORED
    }
}
