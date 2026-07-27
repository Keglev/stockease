package com.stocks.stockease.supplier.web;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body for updating an existing supplier.
 *
 * <p>Both fields are replaced wholesale, so both are mandatory.
 *
 * @param name new supplier display name, must not be blank
 * @param address new supplier postal address, must not be blank
 */
public record UpdateSupplierRequest(
        @NotBlank(message = "Supplier name is required.") String name,
        @NotBlank(message = "Supplier address is required.") String address) {
}
