package com.stocks.stockease.report;

import java.math.BigDecimal;

/**
 * What one live product has sold and what it still holds in stock.
 *
 * @param productId product identifier
 * @param name product name
 * @param sku stock keeping unit
 * @param soldUnits units sold net of customer returns
 * @param soldRevenue revenue of those sales net of refunds
 * @param inStockUnits units currently on hand
 * @param inStockValue units on hand valued at the current purchase price
 */
public record StockStatusReport(Long productId, String name, String sku, int soldUnits, BigDecimal soldRevenue,
        int inStockUnits, BigDecimal inStockValue) {
}
