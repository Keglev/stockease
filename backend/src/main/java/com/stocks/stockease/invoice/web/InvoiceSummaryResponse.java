package com.stocks.stockease.invoice.web;

import java.time.LocalDate;
import java.time.LocalDateTime;

import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.invoice.InvoiceType;

/**
 * API representation of an invoice for list views, safe to build from an uninitialized entity.
 *
 * <p>Counterparty names now travel with the row. They are read from the invoice's own snapshot
 * columns rather than through the association, so the list stays free of both lazy-initialization
 * failures and N+1 queries while gaining the one thing it previously had to resolve client-side -
 * and it keeps naming parties that have since been soft-deleted (ADR 033).
 *
 * @param id unique invoice identifier
 * @param invoiceNumber operator-assigned business identifier; never {@code null}
 * @param type whether the invoice records a purchase or a sale
 * @param status current lifecycle state
 * @param dueDate date payment falls due
 * @param supplierId counterparty identifier for purchase invoices
 * @param supplierName supplier name as it stood at issuance; {@code null} on sale invoices
 * @param customerId counterparty identifier for sale invoices
 * @param customerName customer name as it stood at issuance; {@code null} on purchases and walk-in sales
 * @param closedAt moment the invoice was closed
 * @param paidAt moment the invoice was paid
 * @param createdAt moment the invoice was first persisted
 */
public record InvoiceSummaryResponse(Long id, String invoiceNumber, InvoiceType type, InvoiceStatus status,
        LocalDate dueDate, Long supplierId, String supplierName, Long customerId, String customerName,
        LocalDateTime closedAt, LocalDateTime paidAt, LocalDateTime createdAt) {

    /**
     * Maps an invoice to its list representation without initializing any association.
     *
     * @param invoice the entity to map
     * @return the summary record
     */
    public static InvoiceSummaryResponse from(Invoice invoice) {
        return new InvoiceSummaryResponse(invoice.getId(), invoice.getInvoiceNumber(), invoice.getType(),
                invoice.getStatus(), invoice.getDueDate(),
                invoice.getSupplierId(), invoice.getSupplierName(),
                invoice.getCustomerId(), invoice.getCustomerName(),
                invoice.getClosedAt(), invoice.getPaidAt(), invoice.getCreatedAt());
    }
}
