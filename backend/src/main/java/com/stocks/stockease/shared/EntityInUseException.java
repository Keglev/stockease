package com.stocks.stockease.shared;

import java.util.Map;

/**
 * Thrown when an entity cannot be deleted because other live records still reference it.
 * Open invoices pin the supplier they bill, the customer they invoice and the products on their
 * lines, so deleting any of those is vetoed while the invoice is unsettled; a product holding stock
 * is refused for a different reason, that the units would be stranded.
 *
 * <p>Every instance names its situation with a code from {@link ApiErrorCodes} and carries the
 * values its sentence interpolates. There is deliberately no message-only constructor: the family
 * covers four situations - the supplier, customer and product vetoes, and the stocked product - and
 * one that arrived uncoded would be indistinguishable from the others on the wire (ADR 041).
 *
 * <p>The three vetoes share an operator remedy, settle the invoice first, and are coded apart all
 * the same. Ruling R44 took complete coverage of the family over the distinct-action criterion:
 * every one of the four is a sentence a client has to render in the reader's language, and a code
 * is what lets it.
 *
 * <p>{@link ProductDeletedException} extends this type and supplies its own code, so the
 * constructor below is the single place any of them is built.
 */
public class EntityInUseException extends RuntimeException {

    private final String code;

    private final transient Map<String, String> params;

    /**
     * Creates the exception with a message naming the entity and the references blocking its
     * deletion, the code naming its situation, and the values that message interpolates.
     *
     * @param message human-readable description of the veto
     * @param code situation identifier from {@link ApiErrorCodes}
     * @param params values the message interpolates, keyed by name; empty or {@code null} where the
     *        situation names none
     */
    public EntityInUseException(String message, String code, Map<String, String> params) {
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
