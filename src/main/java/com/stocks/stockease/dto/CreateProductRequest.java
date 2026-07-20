package com.stocks.stockease.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

/**
 * Request body for creating a new product.
 *
 * <p>Contract defined in {@code docs/api/paths/products.yaml}, operation {@code createProduct}.
 */
@Data
public class CreateProductRequest {

    /** Display name of the product. Must not be blank. */
    @NotNull
    @NotBlank
    private String name;

    /** Stock quantity. Must be zero or greater. */
    @NotNull
    @Min(0)
    private Integer quantity;

    /** Unit price in the configured currency. Must be greater than zero. */
    @NotNull
    @Positive
    private Double purchasePrice;
}
