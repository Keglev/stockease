package com.stocks.stockease.supplier.web;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Request body for creating a new supplier.
 *
 * <p>Name and address are mandatory; the service rejects blank values as well. The remaining
 * contact fields are optional, and the email must be well formed when supplied - the same rule
 * {@code CreateCustomerRequest} applies to its own.
 *
 * @param name supplier display name, must not be blank
 * @param email supplier email address, optional but must be well formed when present
 * @param phone supplier phone number, optional
 * @param address supplier postal address, must not be blank
 * @param city supplier city, optional
 */
public record CreateSupplierRequest(
        @NotBlank(message = "Supplier name is required.") String name,
        @Email(message = "Supplier email must be a valid email address.") String email,
        String phone,
        @NotBlank(message = "Supplier address is required.") String address,
        String city) {
}
