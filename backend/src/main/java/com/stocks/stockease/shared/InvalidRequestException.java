package com.stocks.stockease.shared;

import java.util.Map;

/**
 * Thrown when a request asks for something the domain's own rules refuse.
 * The family covers the invoice creation rules, the two period-bound checks, the due-soon window
 * and the supplier's required fields - twelve situations that answer 400 and differ only in what
 * the operator has to change.
 *
 * <p>Every instance names its situation with a code from {@link ApiErrorCodes}. No sentence in this
 * family interpolates a runtime value, so {@code params} is null at every site today; the parameter
 * exists because the shape is the one every coded family uses and a future rule that quotes a value
 * should not have to change the type to do it. There is deliberately no message-only constructor:
 * an uncoded member would be indistinguishable from the other twelve on the wire (ADR 041).
 *
 * <p>Distinct from the JDK's {@link IllegalArgumentException}, which this type replaced at every
 * project throw site and which the handler still maps to an uncoded 400. That handler now answers
 * only for argument failures raised inside libraries the application calls - failures with no
 * situation of ours to name, and no advice we could give about them. The split is what lets a
 * client tell a rule it can explain from one it cannot.
 */
public class InvalidRequestException extends RuntimeException {

    private final String code;

    private final transient Map<String, String> params;

    /**
     * Creates the exception with a message describing the refused request, the code naming its
     * situation, and any values that message interpolates.
     *
     * @param message human-readable description of the refusal
     * @param code situation identifier from {@link ApiErrorCodes}
     * @param params values the message interpolates, keyed by name; empty or {@code null} where the
     *        situation names none, which is every situation in this family today
     */
    public InvalidRequestException(String message, String code, Map<String, String> params) {
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
