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
 * @param address supplier postal address
 * @param createdAt moment the supplier was first persisted
 */
public record SupplierResponse(Long id, String name, String address, LocalDateTime createdAt) {

    /**
     * Maps a persisted supplier to its API representation.
     *
     * @param supplier the entity to map
     * @return the response record carrying the entity's public fields
     */
    public static SupplierResponse from(Supplier supplier) {
        return new SupplierResponse(supplier.getId(), supplier.getName(), supplier.getAddress(),
                supplier.getCreatedAt());
    }
}
