package com.stocks.stockease.invoice;

/** Lifecycle state of an {@link Invoice}. */
public enum InvoiceStatus {
    OPEN,

    /** Set by the system when every line is fully returned. */
    FULLY_RETURNED,

    CLOSED
}
