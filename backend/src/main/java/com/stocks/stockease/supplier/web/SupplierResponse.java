package com.stocks.stockease.supplier.web;

import java.time.LocalDateTime;

import com.stocks.stockease.supplier.Supplier;

/**
 * API representation of a supplier, returned instead of the entity itself.
 *
 * <p>Omits the soft-delete stamp, which is an internal persistence concern.
 *
 * @param id unique supplier identifier
 * @param name supplier display name
 * @param email supplier email address
 * @param phone supplier phone number
 * @param address supplier postal address
 * @param city supplier city
 * @param createdAt moment the supplier was first persisted
 */
public record SupplierResponse(Long id, String name, String email, String phone, String address, String city,
        LocalDateTime createdAt) {

    /**
     * Maps a persisted supplier to its API representation.
     *
     * @param supplier the entity to map
     * @return the response record carrying the entity's public fields
     */
    public static SupplierResponse from(Supplier supplier) {
        return new SupplierResponse(supplier.getId(), supplier.getName(), supplier.getEmail(), supplier.getPhone(),
                supplier.getAddress(), supplier.getCity(), supplier.getCreatedAt());
    }
}
