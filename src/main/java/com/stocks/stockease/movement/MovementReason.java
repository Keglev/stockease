package com.stocks.stockease.movement;

/**
 * Reasons a stock movement can occur. Each reason is bound to its movement
 * direction so an inconsistent type/reason pair cannot be constructed.
 */
public enum MovementReason {

    /** Initial stock at product creation, carries its own cost snapshot. */
    NEW_PRODUCT(MovementType.INCREASE),
    PURCHASE(MovementType.INCREASE),

    /** Customer return, refund reduces revenue. */
    RETURN_FROM_CUSTOMER(MovementType.INCREASE),

    SOLD(MovementType.DECREASE),
    LOST(MovementType.DECREASE),
    DESTROYED(MovementType.DECREASE),
    RETURNED_TO_SUPPLIER(MovementType.DECREASE);

    private final MovementType type;

    MovementReason(MovementType type) {
        this.type = type;
    }

    /** Returns the movement direction this reason is bound to. */
    public MovementType getType() {
        return type;
    }
}
