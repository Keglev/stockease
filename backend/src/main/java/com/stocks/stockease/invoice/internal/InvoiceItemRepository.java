package com.stocks.stockease.invoice.internal;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.invoice.InvoiceItem;
import com.stocks.stockease.invoice.InvoiceStatus;

/** Spring Data JPA repository for {@link InvoiceItem} entities. */
public interface InvoiceItemRepository extends JpaRepository<InvoiceItem, Long> {

    /**
     * Reports whether a product appears on any invoice in the given status, used to veto its deletion.
     *
     * @param productId product identifier
     * @param status lifecycle state of the owning invoice
     * @return {@code true} if such a line exists
     */
    boolean existsByProductIdAndInvoiceStatus(Long productId, InvoiceStatus status);
}
