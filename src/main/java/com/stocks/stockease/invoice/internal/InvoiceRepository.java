package com.stocks.stockease.invoice.internal;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.invoice.Invoice;

/** Spring Data JPA repository for {@link Invoice} entities. */
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {
}
