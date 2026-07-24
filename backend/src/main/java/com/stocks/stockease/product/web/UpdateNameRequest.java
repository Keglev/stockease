package com.stocks.stockease.product.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Request body for updating a product's display name.
 *
 * <p>Contract defined in {@code docs/api/paths/products.yaml}, operation {@code updateName}.
 */
@Data
public class UpdateNameRequest {

    /** Updated display name of the product. Must not be blank. */
    @NotNull
    @NotBlank
    private String name;
}
