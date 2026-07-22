package com.stocks.stockease.report;

import java.math.BigDecimal;

/**
 * Units one product has lost or had destroyed, valued at its current purchase price.
 *
 * @param productId product identifier
 * @param name product name
 * @param sku stock keeping unit
 * @param deleted whether the product has been soft-deleted; historical rows still list it
 * @param lostUnits units written off as lost
 * @param destroyedUnits units written off as destroyed
 * @param lossValue the combined units valued at the current purchase price
 */
public record LossReport(Long productId, String name, String sku, boolean deleted, int lostUnits,
        int destroyedUnits, BigDecimal lossValue) {
}
