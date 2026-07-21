package com.stocks.stockease.invoice.internal;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.invoice.InvoiceItem;

/** Spring Data JPA repository for {@link InvoiceItem} entities. */
public interface InvoiceItemRepository extends JpaRepository<InvoiceItem, Long> {
}
