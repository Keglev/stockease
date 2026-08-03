package com.stocks.stockease.report;

import java.time.LocalDate;

/**
 * One product's stock position at the end of a day that moved it.
 *
 * <p>Only days with at least one movement produce a point: a day nothing happened holds whatever
 * the day before left, so plotting it would add a sample without adding information.
 *
 * <p>Both figures are running totals over the product's whole history, not over the requested
 * window. A window narrows which points come back, never where the counting starts.
 *
 * @param date the day these figures are as of, at its end
 * @param stockLevel units on hand after that day's movements
 * @param cumulativeSoldUnits units sold to customers by then, net of what they returned
 */
public record StockHistoryPoint(LocalDate date, int stockLevel, int cumulativeSoldUnits) {
}
