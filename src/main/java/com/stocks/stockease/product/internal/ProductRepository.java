package com.stocks.stockease.product.internal;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.stocks.stockease.product.Product;

/**
 * Spring Data JPA repository for {@link Product} entities, providing inventory queries and aggregate calculations.
 */
public interface ProductRepository extends JpaRepository<Product, Long> {

    /**
     * Returns products whose stock quantity falls below {@code threshold}, used to identify items requiring reorder.
     *
     * @param threshold quantity boundary (exclusive)
     * @return list of products where quantity < threshold
     */
    @Query("SELECT p FROM Product p WHERE p.quantity < :threshold")
    List<Product> findByQuantityLessThan(@Param("threshold") int threshold);

    /**
     * Returns all products sorted by ID ascending for deterministic ordering across API calls.
     *
     * @return list of all products sorted by ID ascending
     */
    @Query("SELECT p FROM Product p ORDER BY p.id ASC")
    List<Product> findAllOrderById();

    /**
     * Returns the sum of {@code quantity * purchasePrice} across the inventory; {@code COALESCE} ensures {@code 0.0} is returned when no products exist rather than {@code null}.
     *
     * @return sum of all product stock values (quantity times purchase price)
     */
    @Query("SELECT COALESCE(SUM(p.quantity * p.purchasePrice), 0) FROM Product p")
    double calculateTotalStockValue();

    /**
     * Returns products whose name contains {@code name} as a case-insensitive substring.
     *
     * @param name search substring (case-insensitive)
     * @return list of products where name contains substring
     */
    List<Product> findByNameContainingIgnoreCase(String name);
}

