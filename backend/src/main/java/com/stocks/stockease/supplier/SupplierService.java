package com.stocks.stockease.supplier;

import java.util.List;
import java.util.Optional;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.shared.SearchLimits;
import com.stocks.stockease.shared.SearchTerms;
import com.stocks.stockease.shared.TokenSearchSpec;
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
     * Searches live suppliers for the typeahead, matching every token of {@code term} against the
     * name (ADR 035).
     *
     * <p>Name only, unlike the product search: a supplier has no SKU or any other second identifier
     * worth matching, so there is nothing for a token to fall back to. Multi-token matching still
     * applies - "nor tra" finds "North Trading" - because a reader typing into two pickers on one
     * screen should not have to remember which of them tolerates word order.
     *
     * <p>A blank term matches everything and answers the first capped page alphabetically, which is
     * what a focused, empty picker browses.
     *
     * @param term search term, whitespace-separated; may be blank
     * @return matching suppliers, alphabetical, at most {@link SearchLimits#TYPEAHEAD_LIMIT} of them
     */
    public List<Supplier> searchByName(String term) {
        return supplierRepository.findAll(
                TokenSearchSpec.<Supplier>matchingAllTokens(SearchTerms.tokenize(term), "name"),
                TokenSearchSpec.capped("name")).getContent();
    }

    /**
     * Creates and persists a new supplier.
     *
     * @param name supplier display name; must not be blank
     * @param email supplier email, may be {@code null}
     * @param phone supplier phone number, may be {@code null}
     * @param address supplier postal address; must not be blank
     * @param city supplier city, may be {@code null}
     * @return the persisted supplier including its generated ID
     * @throws IllegalArgumentException if name or address is missing or blank
     */
    @Transactional
    public Supplier create(String name, String email, String phone, String address, String city) {
        requireNameAndAddress(name, address);
        Supplier supplier = new Supplier();
        supplier.setName(name);
        supplier.setEmail(email);
        supplier.setPhone(phone);
        supplier.setAddress(address);
        supplier.setCity(city);
        return supplierRepository.save(supplier);
    }

    /**
     * Replaces a supplier's fields.
     *
     * <p>Every field is replaced, including the optional ones: a {@code null} email clears the
     * stored email rather than leaving it in place. Name and address remain mandatory.
     *
     * @param id supplier identifier
     * @param name new display name; must not be blank
     * @param email new email, may be {@code null} to clear it
     * @param phone new phone number, may be {@code null} to clear it
     * @param address new postal address; must not be blank
     * @param city new city, may be {@code null} to clear it
     * @return the updated supplier
     * @throws EntityNotFoundException if no supplier exists with the given ID
     * @throws IllegalArgumentException if name or address is missing or blank
     */
    @Transactional
    public Supplier update(long id, String name, String email, String phone, String address, String city) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Supplier with ID " + id + " not found."));
        requireNameAndAddress(name, address);
        supplier.setName(name);
        supplier.setEmail(email);
        supplier.setPhone(phone);
        supplier.setAddress(address);
        supplier.setCity(city);
        return supplierRepository.save(supplier);
    }

    /**
     * Soft-deletes a supplier, unless a listener vetoes the deletion.
     *
     * @param id supplier identifier
     * @throws EntityNotFoundException if no supplier exists with the given ID
     * @throws com.stocks.stockease.shared.EntityInUseException if a listener vetoes the deletion, for
     *         instance because open invoices still reference the supplier
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
