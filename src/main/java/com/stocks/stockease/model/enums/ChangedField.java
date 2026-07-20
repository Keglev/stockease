package com.stocks.stockease.model.enums;

/** Product attributes whose changes are recorded in the change log. */
public enum ChangedField {

    PURCHASE_PRICE,
    NAME,

    /** Soft delete lifecycle event, values are null. */
    DELETED,

    /** Soft delete lifecycle event, values are null. */
    RESTORED
}
