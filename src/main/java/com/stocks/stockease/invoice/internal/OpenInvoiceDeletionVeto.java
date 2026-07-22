package com.stocks.stockease.invoice.internal;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.product.ProductChangedEvent;
import com.stocks.stockease.supplier.SupplierDeletedEvent;

import lombok.RequiredArgsConstructor;

/**
 * Open invoices pin the parties they reference: neither the supplier billed nor a product on a line
 * may disappear while the invoice is unsettled. These synchronous listeners veto supplier and product
 * deletions inside the deleting transaction.
 */
@Component
@RequiredArgsConstructor
public class OpenInvoiceDeletionVeto {

    private final InvoiceRepository invoiceRepository;
    private final InvoiceItemRepository invoiceItemRepository;

    /**
     * Vetoes deleting a supplier that still has open invoices.
     *
     * @param event the pending supplier deletion
     * @throws IllegalStateException if any open invoice references the supplier
     */
    @EventListener
    public void onSupplierDeleted(SupplierDeletedEvent event) {
        if (invoiceRepository.existsBySupplierIdAndStatus(event.supplierId(), InvoiceStatus.OPEN)) {
            throw new IllegalStateException(
                    "Cannot delete supplier '" + event.supplierName() + "': open invoices exist.");
        }
    }

    /**
     * Vetoes deleting a product that appears on an open invoice; other product changes are ignored.
     *
     * @param event the product change being recorded
     * @throws IllegalStateException if the product is a line on any open invoice
     */
    @EventListener
    public void onProductChanged(ProductChangedEvent event) {
        if (event.field() != ProductChangedEvent.Field.DELETED) {
            return;
        }
        if (invoiceItemRepository.existsByProductIdAndInvoiceStatus(
                event.product().getId(), InvoiceStatus.OPEN)) {
            throw new IllegalStateException("Cannot delete product '" + event.product().getName()
                    + "': it appears on an open invoice.");
        }
    }
}
