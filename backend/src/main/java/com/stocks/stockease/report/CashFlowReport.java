package com.stocks.stockease.report;

import java.math.BigDecimal;
import java.util.List;

/**
 * Money in and out over the reported period, on a payment basis. This is the companion to the
 * profit report: purchases and supplier returns left gross profit in ADR 024 because they move cash
 * rather than earn it, and this is where they land.
 *
 * <p>The totals are the sums of the product rows. Every invoice line names a product, so there is
 * nothing a row could miss and no second aggregate query is needed to compute them.
 *
 * @param inflow total received through paid sale invoices
 * @param outflow total spent through paid purchase invoices
 * @param net inflow less outflow; negative when more was spent than received
 * @param products per-product breakdown, ordered by net descending
 */
public record CashFlowReport(BigDecimal inflow, BigDecimal outflow, BigDecimal net,
        List<CashFlowProductRow> products) {
}
