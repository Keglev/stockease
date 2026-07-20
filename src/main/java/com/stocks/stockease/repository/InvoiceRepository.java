package com.stocks.stockease.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.model.Invoice;

/** Spring Data JPA repository for {@link Invoice} entities. */
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {
}
