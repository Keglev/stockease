package com.stocks.stockease.report;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A product this business has actually bought from one supplier.
 *
 * <p>Carries the same fields as the product API's own representation so a caller can feed either
 * search into the same picker, but it is this module's record rather than that module's: the
 * reporting read model depends on no other module's types.
 *
 * @param id unique product identifier
 * @param name product display name
 * @param sku stock keeping unit identifier
 * @param quantity number of units currently in stock
 * @param purchasePrice unit purchase price
 * @param totalValue stock value, {@code purchasePrice} times {@code quantity}
 * @param createdAt moment the product was first persisted
 */
public record SupplierProduct(Long id, String name, String sku, Integer quantity, BigDecimal purchasePrice,
        BigDecimal totalValue, LocalDateTime createdAt) {
}
