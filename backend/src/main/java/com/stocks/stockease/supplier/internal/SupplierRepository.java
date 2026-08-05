package com.stocks.stockease.supplier.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.stocks.stockease.supplier.Supplier;

/**
 * Spring Data JPA repository for {@link Supplier} entities.
 *
 * <p>The typeahead search is no longer a derived query. It matches a VARIABLE number of tokens,
 * every one of which must hit the name (ADR 035), and no method name can express that - so it is
 * built as a Specification in {@code SupplierService} and executed through the executor below.
 * Criteria queries are mapped queries, so the entity's {@code @SQLRestriction} still keeps
 * soft-deleted rows out; a native query would have bypassed it.
 */
public interface SupplierRepository extends JpaRepository<Supplier, Long>,
        JpaSpecificationExecutor<Supplier> {
}
