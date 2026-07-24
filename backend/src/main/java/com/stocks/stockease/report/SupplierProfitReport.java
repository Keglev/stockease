package com.stocks.stockease.report;

import java.math.BigDecimal;

/**
 * Gross profit attributed to one supplier across the products it has supplied.
 *
 * @param supplierId supplier identifier
 * @param name supplier name
 * @param revenue summed revenue of the supplied products
 * @param cost summed cost of the supplied products
 * @param grossProfit revenue minus cost
 */
public record SupplierProfitReport(Long supplierId, String name, BigDecimal revenue, BigDecimal cost,
        BigDecimal grossProfit) {
}
