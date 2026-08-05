package com.stocks.stockease.invoice.web;

import java.math.BigDecimal;

import com.stocks.stockease.invoice.InvoiceItem;

/**
 * API representation of a single invoice line.
 *
 * <p>Touches no association: the name comes from the line's own snapshot and the id from its
 * foreign-key scalar, so a line whose product has since been soft-deleted still renders (ADR 033).
 *
 * @param id unique invoice item identifier
 * @param productId product purchased or sold on this line
 * @param productName product name as it stood when the invoice was issued
 * @param quantity number of units on the line
 * @param unitPrice price snapshot per unit
 * @param returnedQty number of units returned so far
 */
public record InvoiceItemResponse(Long id, Long productId, String productName, Integer quantity, BigDecimal unitPrice,
        Integer returnedQty) {

    /**
     * Maps an invoice line to its API representation.
     *
     * @param item the entity to map
     * @return the item record
     */
    public static InvoiceItemResponse from(InvoiceItem item) {
        return new InvoiceItemResponse(item.getId(), item.getProductId(), item.getProductName(),
                item.getQuantity(), item.getUnitPrice(), item.getReturnedQty());
    }
}
