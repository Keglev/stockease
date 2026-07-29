package com.stocks.stockease.product.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Request body for creating a new product.
 *
 * <p>Carries master data only: the identifying fields and the price. There is no quantity, because
 * creation books no stock - a new product starts at zero and every unit it later holds arrives
 * through a movement that documents it (ADR 018).
 *
 * <p>Contract defined in {@code docs/api/paths/products.yaml}, operation {@code createProduct}.
 */
@Data
public class CreateProductRequest {

    /** Display name of the product. Must not be blank. */
    @NotNull
    @NotBlank
    private String name;

    /** Stock keeping unit assigned by the operator. Must not be blank; never generated. */
    @NotNull
    @NotBlank
    @Size(max = 64)
    private String sku;

    /** Unit price in the configured currency. Must be greater than zero. */
    @NotNull
    @Positive
    private Double purchasePrice;
}
