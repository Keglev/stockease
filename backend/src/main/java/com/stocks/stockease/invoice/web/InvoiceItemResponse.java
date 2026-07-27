package com.stocks.stockease.invoice.web;

import java.math.BigDecimal;

import com.stocks.stockease.invoice.InvoiceItem;

/**
 * API representation of a single invoice line.
 *
 * <p>Reads the product's name, so it may only be built from an item whose product is initialized.
 *
 * @param id unique invoice item identifier
 * @param productId product purchased or sold on this line
 * @param productName product display name at read time
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
        return new InvoiceItemResponse(item.getId(), item.getProduct().getId(), item.getProduct().getName(),
                item.getQuantity(), item.getUnitPrice(), item.getReturnedQty());
    }
}
