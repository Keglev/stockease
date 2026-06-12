package com.stocks.stockease.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Request body for updating a product's stock quantity.
 *
 * <p>Contract defined in {@code docs/api/paths/products.yaml}, operation {@code updateQuantity}.
 */
@Data
public class UpdateQuantityRequest {

    /** Updated stock quantity. Must be zero or greater. */
    @NotNull
    @Min(0)
    private Integer quantity;
}
