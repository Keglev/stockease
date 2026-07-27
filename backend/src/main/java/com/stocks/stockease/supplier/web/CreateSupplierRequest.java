package com.stocks.stockease.supplier.web;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body for creating a new supplier.
 *
 * <p>Both fields are mandatory; the service rejects blank values as well.
 *
 * @param name supplier display name, must not be blank
 * @param address supplier postal address, must not be blank
 */
public record CreateSupplierRequest(
        @NotBlank(message = "Supplier name is required.") String name,
        @NotBlank(message = "Supplier address is required.") String address) {
}
