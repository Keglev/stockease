package com.stocks.stockease.supplier;

import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.supplier.internal.SupplierRepository;

import lombok.RequiredArgsConstructor;

/**
 * Supplier module's public API for looking up suppliers.
 * Other modules depend on this service rather than reaching into the module's repository.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SupplierService {

    private final SupplierRepository supplierRepository;

    /**
     * Finds a supplier by its ID.
     *
     * @param id supplier identifier
     * @return the supplier, or empty if none exists with that ID
     */
    public Optional<Supplier> findById(long id) {
        return supplierRepository.findById(id);
    }
}
