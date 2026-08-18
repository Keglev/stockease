package com.stocks.stockease.shared;

import java.util.Map;

/**
 * Thrown when a live resource already carries the unique attribute a request tries to claim.
 * Product names and SKUs are unique among live rows, so creating, renaming or restoring a product
 * that would collide with an existing one is rejected, as is an invoice reusing a number.
 *
 * <p>Every instance names its situation with a code from {@link ApiErrorCodes} and carries the value
 * its sentence interpolates. There is deliberately no message-only constructor: the family covers
 * five distinct situations whose advice to the operator differs, and one that arrived uncoded would
 * be indistinguishable from the others on the wire (ADR 041).
 */
public class DuplicateResourceException extends RuntimeException {

    private final String code;

    private final transient Map<String, String> params;

    /**
     * Creates the exception with a message naming the conflicting attribute value, the code naming
     * its situation, and the values that message interpolates.
     *
     * @param message human-readable description of the conflict
     * @param code situation identifier from {@link ApiErrorCodes}
     * @param params values the message interpolates, keyed by name
     */
    public DuplicateResourceException(String message, String code, Map<String, String> params) {
        super(message);
        this.code = code;
        // Stored as null when empty: an empty params is a wire shape nothing should emit, and
        // collapsing it here keeps params omitted from the JSON exactly as an absent code is.
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
