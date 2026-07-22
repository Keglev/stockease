package com.stocks.stockease.invoice;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Request to create an invoice together with all of its lines; the counterparty field that applies
 * depends on {@code type}, and an invoice is never created without at least one line.
 *
 * @param type whether this invoice records a purchase from a supplier or a sale to a customer
 * @param supplierId counterparty for purchase invoices; must be {@code null} for sales
 * @param customerId counterparty for sale invoices; optional for anonymous cash sales, {@code null} for purchases
 * @param dueDate date payment falls due
 * @param interestRate late-payment interest rate; defaults to zero when {@code null}
 * @param fineValue accrued late-payment fine; defaults to zero when {@code null}
 * @param items the lines to create, at least one
 */
public record CreateInvoiceCommand(InvoiceType type, Long supplierId, Long customerId, LocalDate dueDate,
        BigDecimal interestRate, BigDecimal fineValue, List<ItemLine> items) {

    /**
     * A single line to create on the invoice.
     *
     * @param productId product being purchased or sold
     * @param quantity number of units; must be positive
     * @param unitPrice price snapshot per unit; must be positive
     */
    public record ItemLine(Long productId, int quantity, BigDecimal unitPrice) {
    }
}
