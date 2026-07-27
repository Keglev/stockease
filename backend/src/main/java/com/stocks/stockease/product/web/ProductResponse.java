package com.stocks.stockease.product.web;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.stocks.stockease.product.Product;

/**
 * API representation of a product, returned instead of the entity itself.
 *
 * <p>{@code totalValue} is derived here, at mapping time: the entity no longer computes it, so the
 * value exists only on responses and never travels with a persistent object. The soft-delete stamp is
 * omitted as an internal persistence concern.
 *
 * @param id unique product identifier
 * @param name product display name
 * @param sku stock keeping unit identifier
 * @param quantity number of units in stock
 * @param purchasePrice unit purchase price
 * @param totalValue stock value, {@code purchasePrice} times {@code quantity}
 * @param createdAt moment the product was first persisted
 */
public record ProductResponse(Long id, String name, String sku, Integer quantity, BigDecimal purchasePrice,
        BigDecimal totalValue, LocalDateTime createdAt) {

    /**
     * Maps a product to its API representation, deriving the total stock value.
     *
     * @param product the entity to map
     * @return the response record including the derived total value
     */
    public static ProductResponse from(Product product) {
        return new ProductResponse(product.getId(), product.getName(), product.getSku(), product.getQuantity(),
                product.getPurchasePrice(), totalValueOf(product), product.getCreatedAt());
    }

    /** Both operands are non-null on persisted rows, but a half-built product must not blow up mapping. */
    private static BigDecimal totalValueOf(Product product) {
        if (product.getPurchasePrice() == null || product.getQuantity() == null) {
            return null;
        }
        return product.getPurchasePrice().multiply(BigDecimal.valueOf(product.getQuantity()));
    }
}
