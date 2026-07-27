package com.stocks.stockease.customer;

/**
 * Published inside the deleting transaction BEFORE the delete is applied; synchronous listeners may
 * veto the deletion by throwing.
 *
 * @param customerId customer about to be deleted
 * @param customerName customer name, carried so a veto can name it without reloading the row
 */
public record CustomerDeletedEvent(Long customerId, String customerName) {
}
