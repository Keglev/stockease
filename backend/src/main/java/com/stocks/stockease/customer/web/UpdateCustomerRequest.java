package com.stocks.stockease.customer.web;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Request body for updating an existing customer.
 *
 * <p>All fields are replaced wholesale. Only the name is mandatory, exactly as on creation - the
 * contact fields stay optional here rather than picking up the supplier's mandatory address, because
 * a customer's own creation rules are what an edit has to agree with. An optional field may be
 * replaced with absent, which clears it: omitting one is a request to remove it, not a request to
 * leave it alone. The email must be well formed when supplied.
 *
 * @param name new customer display name, must not be blank
 * @param email new customer email address, optional but must be well formed when present
 * @param phone new customer phone number, optional
 * @param address new customer postal address, optional
 * @param city new customer city, optional
 */
public record UpdateCustomerRequest(
        @NotBlank(message = "Customer name is required.") String name,
        @Email(message = "Customer email must be a valid email address.") String email,
        String phone,
        String address,
        String city) {
}
