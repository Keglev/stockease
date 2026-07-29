package com.stocks.stockease.invoice.internal;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
     * Reports whether a customer has any invoice in the given status, used to veto its deletion.
     *
     * @param customerId customer identifier
     * @param status lifecycle state to look for
     * @return {@code true} if such an invoice exists
     */
    boolean existsByCustomerIdAndStatus(Long customerId, InvoiceStatus status);

    /**
     * Reports whether a live invoice already carries {@code invoiceNumber}; the entity's
     * {@code @SQLRestriction} keeps soft-deleted rows out of the check, so a deleted invoice's
     * number can be issued again exactly as the partial index allows.
     *
     * @param invoiceNumber business identifier to look for
     * @return {@code true} if a live invoice already carries that number
     */
    boolean existsByInvoiceNumber(String invoiceNumber);

    /**
     * Returns every invoice a user closed, most recently closed first.
     *
     * @param userId user identifier
     * @return the invoices that user closed, ordered by closing time descending
     */
    List<Invoice> findByClosedByIdOrderByClosedAtDesc(Long userId);

    /**
     * Returns every live invoice, newest first.
     *
     * @return all invoices ordered by creation time descending
     */
    List<Invoice> findAllByOrderByCreatedAtDesc();

    /**
     * Loads one invoice with its items, their products and both counterparties initialized.
     *
     * @param id invoice identifier
     * @return the fully initialized invoice, or empty if none exists with that ID
     */
    // only the items collection is fetch-joined; a second collection join would produce a cartesian product
    @Query("select distinct i from Invoice i left join fetch i.items it left join fetch it.product "
            + "left join fetch i.supplier left join fetch i.customer where i.id = :id")
    Optional<Invoice> findDetailById(@Param("id") Long id);
}
