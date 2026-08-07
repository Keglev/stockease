package com.stocks.stockease.movement;

/**
 * The direction a stock movement moves quantity in: into stock or out of it.
 *
 * <p>Direction is kept separate from the reason for the movement so quantity arithmetic never has to
 * enumerate reasons - a movement's sign follows from this alone, and a new reason cannot silently
 * change the sign of the stock it books.
 */
public enum MovementType {
    INCREASE,
    DECREASE
}
