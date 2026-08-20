package com.stocks.stockease.shared;

/**
 * Thrown when an operation needs a live product but the one it names has been soft-deleted.
 *
 * <p>Extends {@link EntityInUseException} rather than replacing it: both are 409s about a
 * soft-delete boundary. The parent family now carries codes of its own (ADR 041, ruling R44), so
 * the subtype is no longer what makes a code possible here; it is what fixes this one. A caller
 * cannot raise this situation under another code, and the deletion vetoes that raise the parent
 * type are a different situation with different advice.
 */
public class ProductDeletedException extends EntityInUseException {

    /**
     * Creates the exception with a message naming the product and the way forward, supplying
     * {@link ApiErrorCodes#PRODUCT_DELETED} to the parent constructor.
     *
     * <p>Message-only by design, and the only member of this family that still is: the code is
     * fixed because the subtype exists to carry exactly that one, and no params are added because
     * the wire shape here is shipped contract - the frontend branches on this code today, so the
     * message stays byte-identical and {@code params} stays absent.
     *
     * @param message human-readable description of the refusal
     */
    public ProductDeletedException(String message) {
        super(message, ApiErrorCodes.PRODUCT_DELETED, null);
    }
}
