package com.stocks.stockease.shared;

/**
 * Thrown when an entity cannot be deleted because other live records still reference it.
 * Open invoices pin the supplier they bill and the products on their lines, so deleting either is
 * vetoed while the invoice is unsettled.
 */
public class EntityInUseException extends RuntimeException {

    /**
     * Creates the exception with a message naming the entity and the references blocking its deletion.
     *
     * @param message human-readable description of the veto
     */
    public EntityInUseException(String message) {
        super(message);
    }
}
