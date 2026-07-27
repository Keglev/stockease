package com.stocks.stockease.invoice.web;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.stocks.stockease.invoice.CreateInvoiceCommand;
import com.stocks.stockease.invoice.InvoiceType;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * Request body for creating an invoice together with all of its lines.
 *
 * <p>Only field-level rules live here; which counterparty a type requires stays a service-level rule,
 * so both counterparty identifiers are nullable at this layer.
 *
 * @param type whether this invoice records a purchase from a supplier or a sale to a customer
 * @param supplierId counterparty for purchase invoices
 * @param customerId counterparty for sale invoices
 * @param dueDate date payment falls due
 * @param interestRate late-payment interest rate; defaults to zero when {@code null}
 * @param fineValue accrued late-payment fine; defaults to zero when {@code null}
 * @param items the lines to create, at least one
 */
public record CreateInvoiceRequest(
        @NotNull(message = "Invoice type is required.") InvoiceType type,
        Long supplierId,
        Long customerId,
        @NotNull(message = "Due date is required.") LocalDate dueDate,
        @PositiveOrZero(message = "Interest rate must not be negative.") BigDecimal interestRate,
        @PositiveOrZero(message = "Fine value must not be negative.") BigDecimal fineValue,
        @NotEmpty(message = "An invoice requires at least one item.") @Valid List<ItemRequest> items) {

    /**
     * A single line to create on the invoice.
     *
     * @param productId product being purchased or sold
     * @param quantity number of units; must be positive
     * @param unitPrice price snapshot per unit; must be positive
     */
    public record ItemRequest(
            @NotNull(message = "Item product is required.") Long productId,
            @Positive(message = "Item quantity must be positive.") int quantity,
            @NotNull(message = "Item unit price is required.")
            @Positive(message = "Item unit price must be positive.") BigDecimal unitPrice) {
    }

    /**
     * Maps this request to the command the invoice service accepts.
     *
     * @return the equivalent creation command
     */
    public CreateInvoiceCommand toCommand() {
        List<CreateInvoiceCommand.ItemLine> lines = items.stream()
                .map(item -> new CreateInvoiceCommand.ItemLine(item.productId(), item.quantity(), item.unitPrice()))
                .toList();
        return new CreateInvoiceCommand(type, supplierId, customerId, dueDate, interestRate, fineValue, lines);
    }
}
