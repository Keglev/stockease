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
 * raise it - the class is an implementation detail the client must not depend on.
 *
 * <p>A code is optional by design. Most failures carry none, because the client has nothing useful
 * to do with them beyond showing the message; a code is added when a status alone leaves the client
 * unable to tell two situations apart that need different guidance. That is exactly the case these
 * two answer: both are 409 on the return endpoint, and the advice they call for is opposite.
 */
public final class ApiErrorCodes {

    /**
     * A return was attempted against a line whose product is soft-deleted. The operator can act on
     * this: restoring the product makes the same return an ordinary one (ADR 033).
     */
    public static final String PRODUCT_DELETED = "PRODUCT_DELETED";

    /** A stock change would drive the product's quantity below zero, so it was rejected. */
    public static final String INSUFFICIENT_STOCK = "INSUFFICIENT_STOCK";

    private ApiErrorCodes() {
    }
}
