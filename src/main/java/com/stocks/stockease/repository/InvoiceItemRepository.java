package com.stocks.stockease.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.model.InvoiceItem;

/** Spring Data JPA repository for {@link InvoiceItem} entities. */
public interface InvoiceItemRepository extends JpaRepository<InvoiceItem, Long> {
}
