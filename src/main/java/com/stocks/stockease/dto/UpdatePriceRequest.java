package com.stocks.stockease.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

/**
 * Request body for updating a product's unit price.
 *
 * <p>Contract defined in {@code docs/api/paths/products.yaml}, operation {@code updatePrice}.
 */
@Data
public class UpdatePriceRequest {

    /** Updated unit price in the configured currency. Must be greater than zero. */
    @NotNull
    @Positive
    private Double price;
}
