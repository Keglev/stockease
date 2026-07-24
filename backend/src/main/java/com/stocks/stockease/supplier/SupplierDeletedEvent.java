package com.stocks.stockease.supplier;

/**
 * Published inside the deleting transaction BEFORE the delete is applied; synchronous listeners may
 * veto the deletion by throwing.
 *
 * @param supplierId supplier about to be deleted
 * @param supplierName supplier name, carried so a veto can name it without reloading the row
 */
public record SupplierDeletedEvent(Long supplierId, String supplierName) {
}
