package com.stocks.stockease.report;

import java.math.BigDecimal;

/**
 * Gross profit for one product across its whole movement history.
 *
 * @param productId product identifier
 * @param name product name
 * @param sku stock keeping unit
 * @param deleted whether the product has been soft-deleted; historical rows still list it
 * @param revenue sales less customer-return refunds
 * @param cost purchases and opening stock less supplier-return recoveries
 * @param grossProfit revenue minus cost
 */
public record ProductProfitReport(Long productId, String name, String sku, boolean deleted, BigDecimal revenue,
        BigDecimal cost, BigDecimal grossProfit) {
}
