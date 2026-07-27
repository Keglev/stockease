package com.stocks.stockease.customer.web;

import java.time.LocalDateTime;

import com.stocks.stockease.customer.Customer;

/**
 * API representation of a customer, returned instead of the entity itself.
 *
 * <p>Omits the soft-delete stamp, which is an internal persistence concern.
 *
 * @param id unique customer identifier
 * @param name customer display name
 * @param email customer email address
 * @param phone customer phone number
 * @param address customer postal address
 * @param city customer city
 * @param createdAt moment the customer was first persisted
 */
public record CustomerResponse(Long id, String name, String email, String phone, String address, String city,
        LocalDateTime createdAt) {

    /**
     * Maps a persisted customer to its API representation.
     *
     * @param customer the entity to map
     * @return the response record carrying the entity's public fields
     */
    public static CustomerResponse from(Customer customer) {
        return new CustomerResponse(customer.getId(), customer.getName(), customer.getEmail(), customer.getPhone(),
                customer.getAddress(), customer.getCity(), customer.getCreatedAt());
    }
}
