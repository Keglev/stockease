package com.stocks.stockease.invoice.web;

import java.time.LocalDate;
import java.time.LocalDateTime;

import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.invoice.InvoiceType;

/**
 * API representation of an invoice for list views, safe to build from an uninitialized entity.
 *
 * <p>Counterparties appear as identifiers only, never as names: reading an identifier off a lazy
 * association touches the proxy's key rather than loading the row, which is what keeps listing many
 * invoices free of both lazy-initialization failures and N+1 queries. Use {@link InvoiceResponse}
 * when names are needed.
 *
 * @param id unique invoice identifier
 * @param invoiceNumber operator-assigned business identifier; never {@code null}
 * @param type whether the invoice records a purchase or a sale
 * @param status current lifecycle state
 * @param dueDate date payment falls due
 * @param supplierId counterparty identifier for purchase invoices
 * @param customerId counterparty identifier for sale invoices
 * @param closedAt moment the invoice was closed
 * @param paidAt moment the invoice was paid
 * @param createdAt moment the invoice was first persisted
 */
public record InvoiceSummaryResponse(Long id, String invoiceNumber, InvoiceType type, InvoiceStatus status,
        LocalDate dueDate, Long supplierId, Long customerId, LocalDateTime closedAt, LocalDateTime paidAt,
        LocalDateTime createdAt) {

    /**
     * Maps an invoice to its list representation without initializing any association.
     *
     * @param invoice the entity to map
     * @return the summary record
     */
    public static InvoiceSummaryResponse from(Invoice invoice) {
        return new InvoiceSummaryResponse(invoice.getId(), invoice.getInvoiceNumber(), invoice.getType(),
                invoice.getStatus(), invoice.getDueDate(),
                invoice.getSupplier() == null ? null : invoice.getSupplier().getId(),
                invoice.getCustomer() == null ? null : invoice.getCustomer().getId(),
                invoice.getClosedAt(), invoice.getPaidAt(), invoice.getCreatedAt());
    }
}
