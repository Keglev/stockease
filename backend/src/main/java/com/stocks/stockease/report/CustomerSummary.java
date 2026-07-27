package com.stocks.stockease.report;

import java.math.BigDecimal;

/**
 * What one customer has bought and returned across its booked sale invoices.
 *
 * <p>Only booked business counts: a sale invoice still OPEN is recorded but has not happened yet, so
 * it contributes nothing. Bought figures come from each line's quantity times its selling-price
 * snapshot, and returned figures from the returned quantity times that same snapshot, so a return is
 * always valued at what the customer actually paid. A soft-deleted customer keeps reporting with
 * {@code deleted} set: the history it took part in stays true after the customer is gone.
 *
 * @param customerId customer identifier
 * @param name customer name
 * @param deleted whether the customer has been soft-deleted
 * @param saleInvoiceCount number of booked sale invoices naming this customer
 * @param boughtUnits units bought across those invoices
 * @param boughtValue value bought, at the lines' selling-price snapshots
 * @param returnedUnits units returned across those invoices
 * @param returnedValue value returned, at the same snapshots
 */
public record CustomerSummary(Long customerId, String name, boolean deleted, long saleInvoiceCount, long boughtUnits,
        BigDecimal boughtValue, long returnedUnits, BigDecimal returnedValue) {
}
