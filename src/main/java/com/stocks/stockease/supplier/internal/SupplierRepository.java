package com.stocks.stockease.supplier.internal;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.supplier.Supplier;

/** Spring Data JPA repository for {@link Supplier} entities. */
public interface SupplierRepository extends JpaRepository<Supplier, Long> {
}
