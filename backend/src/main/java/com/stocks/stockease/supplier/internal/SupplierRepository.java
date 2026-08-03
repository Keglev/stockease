package com.stocks.stockease.supplier.internal;

import java.util.List;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.supplier.Supplier;

/** Spring Data JPA repository for {@link Supplier} entities. */
public interface SupplierRepository extends JpaRepository<Supplier, Long> {

    /**
     * Returns live suppliers whose name contains {@code name} as a case-insensitive substring, at
     * most {@code limit} of them; the entity's {@code @SQLRestriction} keeps soft-deleted rows out.
     *
     * <p>Ordered by name rather than left to the database: under a cap the ordering decides which
     * matches a caller sees at all, and an unordered LIMIT would hand the same search different
     * suppliers on different runs.
     *
     * @param name search substring (case-insensitive)
     * @param limit most rows to return
     * @return matching live suppliers, alphabetical, capped at {@code limit}
     */
    List<Supplier> findByNameContainingIgnoreCaseOrderByNameAsc(String name, Limit limit);
}
