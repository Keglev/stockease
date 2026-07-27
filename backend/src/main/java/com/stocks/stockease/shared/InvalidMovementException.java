package com.stocks.stockease.shared;

/**
 * Thrown when a stock movement request violates the movement validation matrix.
 * The matrix governs which fields each movement reason requires, forbids, and how the movement must
 * relate to its invoice item.
 */
public class InvalidMovementException extends RuntimeException {

    /**
     * Creates the exception with a message describing the violated movement rule.
     *
     * @param message human-readable description of the violation
     */
    public InvalidMovementException(String message) {
        super(message);
    }
}
