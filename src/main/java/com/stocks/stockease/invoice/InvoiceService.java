package com.stocks.stockease.invoice;

import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.invoice.internal.InvoiceItemRepository;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

/**
 * Invoice module's public API for looking up invoice items and registering returns.
 * Other modules depend on this service rather than reaching into the module's repositories.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InvoiceService {

    private final InvoiceItemRepository invoiceItemRepository;

    /**
     * Finds an invoice item by its ID.
     *
     * @param id invoice item identifier
     * @return the invoice item, or empty if none exists with that ID
     */
    public Optional<InvoiceItem> findItemById(long id) {
        return invoiceItemRepository.findById(id);
    }

    /**
     * Registers a return of {@code quantity} units against an invoice item.
     *
     * @param itemId invoice item identifier
     * @param quantity number of units being returned; must be positive
     * @return the updated invoice item
     * @throws EntityNotFoundException if no invoice item exists with the given ID
     * @throws IllegalArgumentException if {@code quantity} is not positive
     * @throws IllegalStateException if the return would exceed the item's remaining returnable quantity
     */
    @Transactional
    public InvoiceItem registerReturn(long itemId, int quantity) {
        InvoiceItem item = invoiceItemRepository.findById(itemId)
                .orElseThrow(() -> new EntityNotFoundException("Invoice item with ID " + itemId + " not found."));
        if (quantity <= 0) {
            throw new IllegalArgumentException("Return quantity must be positive.");
        }
        // database CHECK on returned_qty is the backstop for this invariant
        if (item.getReturnedQty() + quantity > item.getQuantity()) {
            throw new IllegalStateException("Return of " + quantity + " exceeds remaining returnable quantity "
                    + (item.getQuantity() - item.getReturnedQty()) + " for invoice item " + itemId + ".");
        }
        item.setReturnedQty(item.getReturnedQty() + quantity);
        return invoiceItemRepository.save(item);
    }
}
