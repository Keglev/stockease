package com.stocks.stockease.report;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One unpaid invoice with what is still owed on it.
 *
 * @param invoiceId invoice identifier
 * @param invoiceType {@code PURCHASE} or {@code SALE} as a plain string
 * @param counterparty supplier or customer name, or {@code Cash sale} when the invoice names neither
 * @param dueDate the date the invoice falls due
 * @param outstandingValue line values net of returned quantities
 * @param daysOverdue days past the due date, or {@code null} when the report does not compute it
 */
public record InvoiceDueSummary(Long invoiceId, String invoiceType, String counterparty, LocalDate dueDate,
        BigDecimal outstandingValue, Long daysOverdue) {
}
