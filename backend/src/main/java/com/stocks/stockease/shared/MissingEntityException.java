package com.stocks.stockease.shared;

import java.util.Map;

import jakarta.persistence.EntityNotFoundException;

/**
 * Thrown when a request names a record that is not there.
 * The family covers seven situations - an unknown customer, invoice, invoice item, product,
 * supplier or profit report, and a restore that found no soft-deleted product - which answer 404
 * and differ only in what the operator was looking for.
 *
 * <p>Every instance names its situation with a code from {@link ApiErrorCodes}, and every code in
 * this family carries the same single param: {@code id}, the identifier the caller asked for and
 * the one value each sentence interpolates. A client that renders these in the reader's language
 * needs it, because the id is the only part of the sentence that is not fixed prose.
 *
 * <p>A subclass of {@link EntityNotFoundException} rather than a sibling of it, which is the whole
 * point of the type. The parent stays exactly what it was - the honest uncoded fallback for a
 * not-found raised by JPA itself, where there is no situation of ours to name - and the handler
 * for it stays too. Because this is a subclass, Spring dispatches an instance of it to the more
 * specific handler and gets the code, while every existing assertion written against the parent
 * type remains true: a test asserting {@code isInstanceOf(EntityNotFoundException.class)} still
 * passes, because an instance of this type is one. Nothing had to be rewritten to be told apart.
 *
 * <p>Same shape as the other coded families - {@link InvalidRequestException},
 * {@link EntityInUseException} - down to the constructor and the transient params. There is
 * deliberately no message-only constructor: an uncoded member would be indistinguishable on the
 * wire from a not-found JPA raised, which is the one distinction this type exists to make
 * (ADR 041).
 */
public class MissingEntityException extends EntityNotFoundException {

    private final String code;

    private final transient Map<String, String> params;

    /**
     * Creates the exception with a message naming what was not found, the code naming its
     * situation, and the values that message interpolates.
     *
     * @param message human-readable description of what is missing
     * @param code situation identifier from {@link ApiErrorCodes}
     * @param params values the message interpolates, keyed by name; every situation in this family
     *        carries {@code id}
     */
    public MissingEntityException(String message, String code, Map<String, String> params) {
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
