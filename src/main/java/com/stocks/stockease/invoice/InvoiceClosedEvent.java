package com.stocks.stockease.invoice;

import java.util.List;

import com.stocks.stockease.security.User;

/**
 * Published inside the closing transaction and handled synchronously, so the close and the stock
 * movements booked from it commit or roll back together.
 *
 * @param invoiceId the invoice that was closed
 * @param type whether the closed invoice records a purchase or a sale
 * @param closedBy user who closed the invoice
 * @param lines one entry per invoice line, carrying what a stock booking needs
 */
public record InvoiceClosedEvent(Long invoiceId, InvoiceType type, User closedBy, List<Line> lines) {

    /**
     * A single closed invoice line.
     *
     * @param invoiceItemId invoice line identifier
     * @param productId product on that line
     * @param quantity number of units on that line
     */
    public record Line(Long invoiceItemId, Long productId, int quantity) {
    }
}
