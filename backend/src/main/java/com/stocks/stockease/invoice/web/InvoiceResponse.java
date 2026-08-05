package com.stocks.stockease.invoice.web;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.invoice.InvoiceType;

/**
 * API representation of a single invoice in full, including its lines and counterparty names.
 *
 * <p>Touches no association. Names come from the invoice's snapshot columns and ids from its
 * foreign-key scalars, both of which are plain columns on the invoice row - so this builds from any
 * loaded invoice, in or out of a session, and keeps naming its parties after they are soft-deleted
 * (ADR 033). Only the items collection still needs initializing, which the detail query fetches.
 *
 * @param id unique invoice identifier
 * @param invoiceNumber operator-assigned business identifier; never {@code null}
 * @param type whether the invoice records a purchase or a sale
 * @param status current lifecycle state
 * @param dueDate date payment falls due
 * @param supplierId counterparty identifier for purchase invoices
 * @param supplierName counterparty name for purchase invoices
 * @param customerId counterparty identifier for sale invoices
 * @param customerName counterparty name for sale invoices
 * @param closedAt moment the invoice was closed
 * @param paidAt moment the invoice was paid
 * @param createdAt moment the invoice was first persisted
 * @param items the invoice's lines
 */
public record InvoiceResponse(Long id, String invoiceNumber, InvoiceType type, InvoiceStatus status,
        LocalDate dueDate, Long supplierId, String supplierName, Long customerId, String customerName,
        LocalDateTime closedAt, LocalDateTime paidAt, LocalDateTime createdAt, List<InvoiceItemResponse> items) {

    /**
     * Maps a fetch-joined invoice to its detail representation.
     *
     * @param invoice the entity to map, loaded with its items initialized; the parties need not be
     * @return the detail record
     */
    public static InvoiceResponse from(Invoice invoice) {
        return new InvoiceResponse(invoice.getId(), invoice.getInvoiceNumber(), invoice.getType(),
                invoice.getStatus(), invoice.getDueDate(),
                invoice.getSupplierId(), invoice.getSupplierName(),
                invoice.getCustomerId(), invoice.getCustomerName(),
                invoice.getClosedAt(), invoice.getPaidAt(), invoice.getCreatedAt(),
                invoice.getItems().stream().map(InvoiceItemResponse::from).toList());
    }
}
