package com.stocks.stockease.audit.internal;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import com.stocks.stockease.audit.ChangedField;
import com.stocks.stockease.audit.ProductChangeLog;
import com.stocks.stockease.product.ProductChangedEvent;

import lombok.RequiredArgsConstructor;

/**
 * Records product changes in the change log.
 * Deliberately a synchronous {@code @EventListener} - change log rows must commit in the same
 * transaction as the product update; an async listener would allow an update whose audit row is
 * silently lost.
 */
@Component
@RequiredArgsConstructor
public class ProductChangedListener {

    private final ProductChangeLogRepository productChangeLogRepository;

    /**
     * Writes one change log row for the reported change.
     *
     * @param event the change published inside the updating transaction
     */
    @EventListener
    public void onProductChanged(ProductChangedEvent event) {
        ProductChangeLog entry = new ProductChangeLog();
        entry.setProduct(event.product());
        entry.setUser(event.user());
        // the product module mirrors these constants by name so it need not depend on the audit module
        entry.setField(ChangedField.valueOf(event.field().name()));
        entry.setOldValue(event.oldValue());
        entry.setNewValue(event.newValue());
        productChangeLogRepository.save(entry);
    }
}
