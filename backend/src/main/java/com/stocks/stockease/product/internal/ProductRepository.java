package com.stocks.stockease.product.internal;

import java.util.List;

import java.util.Optional;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.stocks.stockease.product.Product;

import jakarta.persistence.LockModeType;

/**
 * Spring Data JPA repository for {@link Product} entities, providing inventory queries and aggregate calculations.
 */
public interface ProductRepository extends JpaRepository<Product, Long> {

    /**
     * Returns products that have ever held stock and whose quantity has since fallen below
     * {@code threshold}, used to identify items requiring reorder. A product that was never purchased
     * is new rather than low and is excluded whatever its quantity (ADR 026).
     *
     * @param threshold quantity boundary (exclusive)
     * @return list of ever-stocked products where quantity < threshold
     */
    @Query("SELECT p FROM Product p WHERE p.quantity < :threshold AND p.everStocked = true")
    List<Product> findEverStockedByQuantityLessThan(@Param("threshold") int threshold);

    /**
     * Returns all products sorted by ID ascending for deterministic ordering across API calls.
     *
     * @return list of all products sorted by ID ascending
     */
    @Query("SELECT p FROM Product p ORDER BY p.id ASC")
    List<Product> findAllOrderById();

    /**
     * Returns live products whose name contains {@code name} as a case-insensitive substring,
     * alphabetically and capped for typeahead use. Ordering is part of the contract rather than a
     * nicety: the cap decides which matches a caller sees at all, and an unordered LIMIT would hand
     * the same search different rows on different runs. The entity's {@code @SQLRestriction} keeps
     * soft-deleted rows out.
     *
     * @param name search substring (case-insensitive)
     * @param limit maximum rows to return
     * @return matching live products, name-ascending, at most {@code limit} of them
     */
    List<Product> findByNameContainingIgnoreCaseOrderByNameAsc(String name, Limit limit);

    /**
     * Reports whether a live product already carries {@code name}, ignoring case; the entity's
     * {@code @SQLRestriction} keeps soft-deleted rows out of the check.
     *
     * @param name product name to look for (case-insensitive)
     * @return {@code true} if a live product already has that name
     */
    boolean existsByNameIgnoreCase(String name);

    /**
     * Reports whether a live product other than {@code id} already carries {@code name}, ignoring case;
     * used when renaming so a product does not collide with itself.
     *
     * @param name product name to look for (case-insensitive)
     * @param id product to exclude from the check
     * @return {@code true} if a different live product already has that name
     */
    boolean existsByNameIgnoreCaseAndIdNot(String name, long id);

    /**
     * Reports whether a live product already carries {@code sku}; the entity's {@code @SQLRestriction}
     * keeps soft-deleted rows out of the check.
     *
     * @param sku stock keeping unit to look for
     * @return {@code true} if a live product already has that SKU
     */
    boolean existsBySku(String sku);

    /**
     * Loads a soft-deleted product by ID. Native because {@code @SQLRestriction} hides soft-deleted rows
     * from every mapped query, so restoring one needs an explicit bypass.
     *
     * @param id product identifier
     * @return the soft-deleted product, or empty if no such row exists or it is still live
     */
    @Query(value = "SELECT * FROM product WHERE id = :id AND deleted_at IS NOT NULL", nativeQuery = true)
    Optional<Product> findDeletedById(@Param("id") long id);

    /**
     * Lists every soft-deleted product alphabetically by name, ignoring case. Native for the same reason
     * as {@link #findDeletedById}: {@code @SQLRestriction} hides soft-deleted rows from mapped queries,
     * so the recycle-bin listing needs the sanctioned bypass.
     *
     * @return soft-deleted products ordered by name, case-insensitively ascending
     */
    @Query(value = "SELECT * FROM product WHERE deleted_at IS NOT NULL ORDER BY LOWER(name) ASC",
            nativeQuery = true)
    List<Product> findAllDeleted();

    /**
     * Loads a product for update, holding a pessimistic write lock until the surrounding transaction commits
     * so concurrent stock adjustments serialize rather than interleave on a stale quantity.
     *
     * @param id product identifier
     * @return the locked product, or empty if none exists with that ID
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Product p WHERE p.id = :id")
    Optional<Product> findByIdForUpdate(@Param("id") long id);
}

