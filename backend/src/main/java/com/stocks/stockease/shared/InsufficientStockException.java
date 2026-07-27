package com.stocks.stockease.shared;

/**
 * Thrown when a quantity change would drive a product's stock below zero.
 * Stock is never allowed to go negative, so the adjustment is rejected rather than clamped.
 */
public class InsufficientStockException extends RuntimeException {

    /**
     * Creates the exception with a message describing the rejected adjustment.
     *
     * @param message human-readable description of the shortfall
     */
    public InsufficientStockException(String message) {
        super(message);
    }
}
