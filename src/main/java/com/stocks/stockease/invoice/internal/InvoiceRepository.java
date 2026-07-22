package com.stocks.stockease.invoice.internal;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceStatus;

/** Spring Data JPA repository for {@link Invoice} entities. */
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    /**
     * Reports whether a supplier has any invoice in the given status, used to veto its deletion.
     *
     * @param supplierId supplier identifier
     * @param status lifecycle state to look for
     * @return {@code true} if such an invoice exists
     */
    boolean existsBySupplierIdAndStatus(Long supplierId, InvoiceStatus status);

    /**
     * Returns every invoice a user closed, most recently closed first.
     *
     * @param userId user identifier
     * @return the invoices that user closed, ordered by closing time descending
     */
    List<Invoice> findByClosedByIdOrderByClosedAtDesc(Long userId);
}
