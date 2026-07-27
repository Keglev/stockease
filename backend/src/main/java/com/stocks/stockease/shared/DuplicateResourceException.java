package com.stocks.stockease.shared;

/**
 * Thrown when a live resource already carries the unique attribute a request tries to claim.
 * Product names and SKUs are unique among live rows, so creating, renaming or restoring a product
 * that would collide with an existing one is rejected.
 */
public class DuplicateResourceException extends RuntimeException {

    /**
     * Creates the exception with a message naming the conflicting attribute value.
     *
     * @param message human-readable description of the conflict
     */
    public DuplicateResourceException(String message) {
        super(message);
    }
}
