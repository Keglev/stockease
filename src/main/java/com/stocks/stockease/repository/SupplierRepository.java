package com.stocks.stockease.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.model.Supplier;

/** Spring Data JPA repository for {@link Supplier} entities. */
public interface SupplierRepository extends JpaRepository<Supplier, Long> {
}
