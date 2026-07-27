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
 * <p>Reads associations that are lazy on the entity, so it may only be built from an invoice loaded
 * through the fetch-joined detail query; building it from a list query would fail outside a session.
 *
 * @param id unique invoice identifier
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
public record InvoiceResponse(Long id, InvoiceType type, InvoiceStatus status, LocalDate dueDate, Long supplierId,
        String supplierName, Long customerId, String customerName, LocalDateTime closedAt, LocalDateTime paidAt,
        LocalDateTime createdAt, List<InvoiceItemResponse> items) {

    /**
     * Maps a fetch-joined invoice to its detail representation.
     *
     * @param invoice the entity to map, loaded with items, products and counterparties initialized
     * @return the detail record
     */
    public static InvoiceResponse from(Invoice invoice) {
        return new InvoiceResponse(invoice.getId(), invoice.getType(), invoice.getStatus(), invoice.getDueDate(),
                invoice.getSupplier() == null ? null : invoice.getSupplier().getId(),
                invoice.getSupplier() == null ? null : invoice.getSupplier().getName(),
                invoice.getCustomer() == null ? null : invoice.getCustomer().getId(),
                invoice.getCustomer() == null ? null : invoice.getCustomer().getName(),
                invoice.getClosedAt(), invoice.getPaidAt(), invoice.getCreatedAt(),
                invoice.getItems().stream().map(InvoiceItemResponse::from).toList());
    }
}
