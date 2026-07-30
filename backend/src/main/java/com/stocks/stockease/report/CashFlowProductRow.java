package com.stocks.stockease.report;

import java.math.BigDecimal;

/**
 * What one product moved in cash across paid invoices. Money counts on the date its invoice was
 * paid, so an invoice that is booked but unpaid contributes nothing here regardless of its value.
 *
 * <p>Each line contributes its quantity net of what was returned, valued at the line's own price
 * snapshot: a return therefore reduces the flow of the invoice it belongs to rather than appearing
 * as a movement of its own, which is the approximation ADR 025 records. A soft-deleted product keeps
 * reporting with {@code deleted} set, as in the profit report - the money it moved still moved.
 *
 * @param productId product identifier
 * @param name product name
 * @param sku stock keeping unit
 * @param deleted whether the product has been soft-deleted
 * @param inflow money received for this product through paid sale invoices
 * @param outflow money spent on this product through paid purchase invoices
 * @param net inflow less outflow
 */
public record CashFlowProductRow(Long productId, String name, String sku, boolean deleted, BigDecimal inflow,
        BigDecimal outflow, BigDecimal net) {
}
