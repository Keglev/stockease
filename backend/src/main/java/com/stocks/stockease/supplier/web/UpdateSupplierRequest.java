package com.stocks.stockease.supplier.web;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Request body for updating an existing supplier.
 *
 * <p>All fields are replaced wholesale. Name and address are mandatory, as they have always been;
 * the optional contact fields may be replaced with absent, which clears them - omitting one is a
 * request to remove it, not a request to leave it alone. The email must be well formed when
 * supplied.
 *
 * @param name new supplier display name, must not be blank
 * @param email new supplier email address, optional but must be well formed when present
 * @param phone new supplier phone number, optional
 * @param address new supplier postal address, must not be blank
 * @param city new supplier city, optional
 */
public record UpdateSupplierRequest(
        @NotBlank(message = "Supplier name is required.") String name,
        @Email(message = "Supplier email must be a valid email address.") String email,
        String phone,
        @NotBlank(message = "Supplier address is required.") String address,
        String city) {
}
