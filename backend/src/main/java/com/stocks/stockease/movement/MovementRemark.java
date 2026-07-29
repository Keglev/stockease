package com.stocks.stockease.movement;

/**
 * Why stock was lost or destroyed. One fixed taxonomy serves both reasons (ADR 020): the question
 * "what happened to it" has the same answers whether the units are written off as LOST or as
 * DESTROYED, and a shared list keeps the loss report groupable across the pair.
 *
 * <p>A remark is required by {@code LOST} and {@code DESTROYED} and forbidden for every other
 * reason. It is informational: losses are valued identically regardless of which remark they carry.
 */
public enum MovementRemark {

    /** Shelf life ran out before the units could be sold. */
    EXPIRED,

    /** Lost or damaged on the way to the customer, after leaving the warehouse. */
    IN_TRANSIT_TO_CUSTOMER,

    /** Happened inside the business, with no more specific cause recorded. */
    INTERNAL,

    /** Arrived from the supplier already unusable. */
    FROM_SUPPLIER
}
