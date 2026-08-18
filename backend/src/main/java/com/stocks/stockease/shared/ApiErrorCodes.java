package com.stocks.stockease.shared;

/**
 * Machine-readable failure identifiers carried in the {@code code} field of an error envelope.
 *
 * <p>These are API contract, not log strings. A client branches on them to choose which of its own
 * translated messages to show, so a value that changes silently changes what an operator reads.
 * They are declared here as constants for that reason: an inline literal in a handler is a contract
 * term nobody can find, and the frontend's matching constants have nothing to be checked against.
 *
 * <p>Codes are SCREAMING_SNAKE and name the situation, not the exception class that happened to
 * raise it - the class is an implementation detail the client must not depend on. One exception
 * class may therefore carry several codes, and two throw sites raising the same situation share one.
 *
 * <p>A code is optional by design. Most failures carry none, because the client has nothing useful
 * to do with them beyond showing the message; a code is added when a status alone leaves the client
 * unable to tell two situations apart that need different guidance. ADR 041 governs which situations
 * qualify and how they are delivered, and adds a second test to the first: the failure must reach a
 * screen in normal operation, and it must leave the operator a distinct action.
 *
 * <p>A coded situation whose sentence interpolates a runtime value carries that value in the
 * envelope's {@code params}, because a client rendering its own translated sentence has nowhere
 * else to read it from. Each constant below names its params keys.
 */
public final class ApiErrorCodes {

    /**
     * A return was attempted against a line whose product is soft-deleted. The operator can act on
     * this: restoring the product makes the same return an ordinary one (ADR 033).
     */
    public static final String PRODUCT_DELETED = "PRODUCT_DELETED";

    /** A stock change would drive the product's quantity below zero, so it was rejected. */
    public static final String INSUFFICIENT_STOCK = "INSUFFICIENT_STOCK";

    /**
     * A live product already holds the name a create or rename tried to claim. The operator chooses
     * a different name, or finds the product that already has this one.
     *
     * <p>Params: {@code name} - the name that is taken.
     */
    public static final String DUPLICATE_PRODUCT_NAME = "DUPLICATE_PRODUCT_NAME";

    /**
     * A live product already holds the SKU a create tried to claim. The operator chooses a different
     * SKU, or finds the product that already has this one.
     *
     * <p>Params: {@code sku} - the SKU that is taken.
     */
    public static final String DUPLICATE_PRODUCT_SKU = "DUPLICATE_PRODUCT_SKU";

    /**
     * A restore was refused because a live product has taken the deleted one's name. Distinct from
     * {@link #DUPLICATE_PRODUCT_NAME} because the operator's way out differs: the name cannot simply
     * be chosen again on a row that already has one, so the live product is renamed first, or the
     * restore is abandoned.
     *
     * <p>Params: {@code name} - the name the live product holds.
     */
    public static final String RESTORE_BLOCKED_BY_NAME = "RESTORE_BLOCKED_BY_NAME";

    /**
     * A restore was refused because a live product has taken the deleted one's SKU. The same
     * distinction as {@link #RESTORE_BLOCKED_BY_NAME}, on the other unique attribute.
     *
     * <p>Params: {@code sku} - the SKU the live product holds.
     */
    public static final String RESTORE_BLOCKED_BY_SKU = "RESTORE_BLOCKED_BY_SKU";

    /**
     * An invoice already carries the number a create tried to claim. Numbers are operator-assigned
     * (ADR 022), so the operator supplies another or opens the invoice that already has this one.
     *
     * <p>Params: {@code invoiceNumber} - the number that is taken.
     */
    public static final String DUPLICATE_INVOICE_NUMBER = "DUPLICATE_INVOICE_NUMBER";

    private ApiErrorCodes() {
    }
}
