package com.stocks.stockease.shared;

import java.util.Map;

/**
 * Thrown when an operation is attempted against an invoice whose lifecycle status forbids it.
 * Examples are closing an invoice that is no longer open, or returning units against an invoice that
 * has not been closed yet.
 *
 * <p>Every instance names its situation with a code from {@link ApiErrorCodes}, and carries the
 * values its sentence interpolates where it has any. There is deliberately no message-only
 * constructor: the family covers five lifecycle refusals that share a status and ask the operator
 * for different things - close it first, return instead of deleting, lower the quantity - and one
 * that arrived uncoded would be indistinguishable from the others on the wire (ADR 041).
 */
public class InvoiceStateException extends RuntimeException {

    private final String code;

    private final transient Map<String, String> params;

    /**
     * Creates the exception with a message describing the violated lifecycle rule, the code naming
     * its situation, and the values that message interpolates.
     *
     * @param message human-readable description of the violation
     * @param code situation identifier from {@link ApiErrorCodes}
     * @param params values the message interpolates, keyed by name; empty or {@code null} where the
     *        situation names none
     */
    public InvoiceStateException(String message, String code, Map<String, String> params) {
        super(message);
        this.code = code;
        // Stored as null when empty: an empty params is a wire shape nothing should emit, and
        // collapsing it here keeps params omitted from the JSON exactly as an absent code is.
        // Four of this family's five situations carry none, so this is the ordinary case here.
        this.params = params == null || params.isEmpty() ? null : Map.copyOf(params);
    }

    /**
     * Returns the situation identifier the envelope carries.
     *
     * @return code from {@link ApiErrorCodes}
     */
    public String getCode() {
        return code;
    }

    /**
     * Returns the values the message interpolates, or {@code null} when there are none.
     *
     * @return unmodifiable params map, or {@code null}
     */
    public Map<String, String> getParams() {
        return params;
    }
}
