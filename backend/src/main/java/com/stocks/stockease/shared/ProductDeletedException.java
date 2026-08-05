package com.stocks.stockease.shared;

/**
 * Thrown when an operation needs a live product but the one it names has been soft-deleted.
 *
 * <p>Extends {@link EntityInUseException} rather than replacing it: both are 409s about a
 * soft-delete boundary, and the general handler already answers correctly for this one. The subtype
 * exists so the envelope can carry {@link ApiErrorCodes#PRODUCT_DELETED} on this case alone - the
 * deletion vetoes that raise the parent type are a different situation with different advice, and
 * giving them the same code would tell a client the wrong thing.
 */
public class ProductDeletedException extends EntityInUseException {

    /**
     * Creates the exception with a message naming the product and the way forward.
     *
     * @param message human-readable description of the refusal
     */
    public ProductDeletedException(String message) {
        super(message);
    }
}
