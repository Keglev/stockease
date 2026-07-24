package com.stocks.stockease.report;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Unpaid invoices grouped by the date they fall due and the kind of invoice they are.
 *
 * @param dueDate the date these invoices fall due
 * @param invoiceType {@code PURCHASE} or {@code SALE} as a plain string; importing the invoice
 *        module's enum would create the Java dependency this module exists to avoid
 * @param invoiceCount how many invoices fall in this bucket
 * @param totalValue their combined outstanding value
 */
public record DueDateBucket(LocalDate dueDate, String invoiceType, long invoiceCount, BigDecimal totalValue) {
}
