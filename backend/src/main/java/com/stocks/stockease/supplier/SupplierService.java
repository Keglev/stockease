package com.stocks.stockease.supplier;

import java.util.List;
import java.util.Optional;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.supplier.internal.SupplierRepository;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

/**
 * Supplier module's public API for querying and mutating suppliers.
 * Other modules depend on this service rather than reaching into the module's repository.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SupplierService {

    private final SupplierRepository supplierRepository;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Finds a supplier by its ID.
     *
     * @param id supplier identifier
     * @return the supplier, or empty if none exists with that ID
     */
    public Optional<Supplier> findById(long id) {
        return supplierRepository.findById(id);
    }

    /**
     * Returns every live supplier.
     *
     * @return list of all suppliers that have not been soft-deleted
     */
    public List<Supplier> findAll() {
        return supplierRepository.findAll();
    }

    /**
     * Creates and persists a new supplier.
     *
     * @param name supplier display name; must not be blank
     * @param address supplier postal address; must not be blank
     * @return the persisted supplier including its generated ID
     * @throws IllegalArgumentException if name or address is missing or blank
     */
    @Transactional
    public Supplier create(String name, String address) {
        requireNameAndAddress(name, address);
        Supplier supplier = new Supplier();
        supplier.setName(name);
        supplier.setAddress(address);
        return supplierRepository.save(supplier);
    }

    /**
     * Updates a supplier's name and address.
     *
     * @param id supplier identifier
     * @param name new display name; must not be blank
     * @param address new postal address; must not be blank
     * @return the updated supplier
     * @throws EntityNotFoundException if no supplier exists with the given ID
     * @throws IllegalArgumentException if name or address is missing or blank
     */
    @Transactional
    public Supplier update(long id, String name, String address) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Supplier with ID " + id + " not found."));
        requireNameAndAddress(name, address);
        supplier.setName(name);
        supplier.setAddress(address);
        return supplierRepository.save(supplier);
    }

    /**
     * Soft-deletes a supplier, unless a listener vetoes the deletion.
     *
     * @param id supplier identifier
     * @throws EntityNotFoundException if no supplier exists with the given ID
     * @throws IllegalStateException if a listener vetoes the deletion, for instance because open
     *         invoices still reference the supplier
     */
    @Transactional
    public void deleteById(long id) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Supplier with ID " + id + " not found."));
        // the event fires first so open-invoice vetoes abort before any state changes; a veto exception
        // rolls back the transaction
        eventPublisher.publishEvent(new SupplierDeletedEvent(supplier.getId(), supplier.getName()));
        supplierRepository.delete(supplier);
    }

    /** Rejects a missing or blank name or address with the shared message. */
    private static void requireNameAndAddress(String name, String address) {
        if (name == null || name.isBlank() || address == null || address.isBlank()) {
            throw new IllegalArgumentException("Supplier name and address are required.");
        }
    }
}
