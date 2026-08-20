package com.stocks.stockease.shared;

import java.util.Map;

/**
 * Thrown when a stock movement request violates the movement validation matrix.
 * The matrix governs which fields each movement reason requires, forbids, and how the movement must
 * relate to its invoice item.
 *
 * <p>Every instance names its situation with a code from {@link ApiErrorCodes} and carries the
 * values its sentence interpolates. There is deliberately no message-only constructor: the matrix
 * has sixteen distinct rules, they all answer 400, and one that arrived uncoded would be
 * indistinguishable from the other fifteen on the wire (ADR 041).
 *
 * <p>Ruling R45 coded the whole roster regardless of reachability, and R47 held to it after a path
 * walk found ten of the sixteen unreachable from the HTTP surface. The request records are narrower
 * than the command this service validates - they carry no {@code unitCost} at all, and bean
 * validation and the two controllers' reason gates catch the rest - so most of the matrix guards a
 * caller only the service layer can produce. Those constants say so in their own Javadoc and name
 * the guard that shadows them, so the situation is already named if the shadow ever moves.
 */
public class InvalidMovementException extends RuntimeException {

    private final String code;

    private final transient Map<String, String> params;

    /**
     * Creates the exception with a message describing the violated movement rule, the code naming
     * which rule it was, and the values that message interpolates.
     *
     * @param message human-readable description of the violation
     * @param code situation identifier from {@link ApiErrorCodes}
     * @param params values the message interpolates, keyed by name; empty or {@code null} where the
     *        situation names none
     */
    public InvalidMovementException(String message, String code, Map<String, String> params) {
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
