package com.stocks.stockease.invoice.internal;

import org.springframework.context.event.EventListener;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import com.stocks.stockease.customer.CustomerDeletedEvent;
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.product.ProductChangedEvent;
import com.stocks.stockease.shared.EntityInUseException;
import com.stocks.stockease.supplier.SupplierDeletedEvent;

import lombok.RequiredArgsConstructor;

/**
 * Open invoices pin the parties they reference: neither the supplier billed, the customer invoiced nor
 * a product on a line may disappear while the invoice is unsettled. These synchronous listeners veto
 * supplier, customer and product deletions inside the deleting transaction.
 */
// vetoes are validations and run before any other listener does work - fail fast; ordering is pinned
// so behavior cannot shift with classpath or JVM changes
@Order(Ordered.HIGHEST_PRECEDENCE)
@Component
@RequiredArgsConstructor
public class OpenInvoiceDeletionVeto {

    private final InvoiceRepository invoiceRepository;
    private final InvoiceItemRepository invoiceItemRepository;

    /**
     * Vetoes deleting a supplier that still has open invoices.
     *
     * @param event the pending supplier deletion
     * @throws EntityInUseException if any open invoice references the supplier
     */
    @EventListener
    public void onSupplierDeleted(SupplierDeletedEvent event) {
        if (invoiceRepository.existsBySupplierIdAndStatus(event.supplierId(), InvoiceStatus.OPEN)) {
            throw new EntityInUseException(
                    "Cannot delete supplier '" + event.supplierName() + "': open invoices exist.");
        }
    }

    /**
     * Vetoes deleting a customer that still has open invoices.
     *
     * @param event the pending customer deletion
     * @throws EntityInUseException if any open invoice references the customer
     */
    @EventListener
    public void onCustomerDeleted(CustomerDeletedEvent event) {
        if (invoiceRepository.existsByCustomerIdAndStatus(event.customerId(), InvoiceStatus.OPEN)) {
            throw new EntityInUseException(
                    "Cannot delete customer '" + event.customerName() + "': open invoices exist.");
        }
    }

    /**
     * Vetoes deleting a product that appears on an open invoice; other product changes are ignored.
     *
     * @param event the product change being recorded
     * @throws EntityInUseException if the product is a line on any open invoice
     */
    @EventListener
    public void onProductChanged(ProductChangedEvent event) {
        if (event.field() != ProductChangedEvent.Field.DELETED) {
            return;
        }
        if (invoiceItemRepository.existsByProductIdAndInvoiceStatus(
                event.product().getId(), InvoiceStatus.OPEN)) {
            throw new EntityInUseException("Cannot delete product '" + event.product().getName()
                    + "': it appears on an open invoice.");
        }
    }
}
