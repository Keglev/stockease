package com.stocks.stockease.audit.internal;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.audit.ProductChangeLog;

/** Spring Data JPA repository for {@link ProductChangeLog} entities. */
public interface ProductChangeLogRepository extends JpaRepository<ProductChangeLog, Long> {
}
