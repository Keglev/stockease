package com.stocks.stockease.report;

import java.math.BigDecimal;

/**
 * One calendar month of cash flow, on the same payment basis as the per-product report: money counts
 * in the month its invoice was paid, and each line contributes its quantity net of returns at the
 * line's own price snapshot (ADR 025).
 *
 * <p>Only months that actually moved money produce a bucket. A month with no paid invoice is absent
 * rather than zero-filled - the same reasoning the product rows follow, and what the chart's category
 * axis is built to render.
 *
 * @param month the month this bucket covers, as ISO {@code yyyy-MM}
 * @param inflow money received that month through paid sale invoices
 * @param outflow money spent that month through paid purchase invoices
 * @param net inflow less outflow; negative in a month that spent more than it received
 */
public record CashFlowTimelineBucket(String month, BigDecimal inflow, BigDecimal outflow, BigDecimal net) {
}
