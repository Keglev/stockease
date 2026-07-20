package com.stocks.stockease.model.enums;

/** Lifecycle state of an {@link com.stocks.stockease.model.Invoice}. */
public enum InvoiceStatus {
    OPEN,

    /** Set by the system when every line is fully returned. */
    FULLY_RETURNED,

    CLOSED
}
