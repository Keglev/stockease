package com.stocks.stockease.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.model.ProductChangeLog;

/** Spring Data JPA repository for {@link ProductChangeLog} entities. */
public interface ProductChangeLogRepository extends JpaRepository<ProductChangeLog, Long> {
}
