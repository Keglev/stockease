package com.stocks.stockease.shared;

/**
 * Thrown when an operation is attempted against an invoice whose lifecycle status forbids it.
 * Examples are closing an invoice that is no longer open, or returning units against an invoice that
 * has not been closed yet.
 */
public class InvoiceStateException extends RuntimeException {

    /**
     * Creates the exception with a message describing the violated lifecycle rule.
     *
     * @param message human-readable description of the violation
     */
    public InvoiceStateException(String message) {
        super(message);
    }
}
