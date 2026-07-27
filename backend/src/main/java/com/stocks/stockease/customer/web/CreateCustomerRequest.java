package com.stocks.stockease.customer.web;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Request body for creating a new customer.
 *
 * <p>Only the name is mandatory; the contact fields are optional, and the email must be well formed
 * when supplied.
 *
 * @param name customer display name, must not be blank
 * @param email customer email address, optional but must be well formed when present
 * @param phone customer phone number, optional
 * @param address customer postal address, optional
 * @param city customer city, optional
 */
public record CreateCustomerRequest(
        @NotBlank(message = "Customer name is required.") String name,
        @Email(message = "Customer email must be a valid email address.") String email,
        String phone,
        String address,
        String city) {
}
