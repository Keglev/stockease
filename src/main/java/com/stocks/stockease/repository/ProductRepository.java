package com.stocks.stockease.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.lang.NonNull;

import com.stocks.stockease.model.Product;

/**
 * Spring Data JPA repository for Product entity persistence.
 * 
 * Provides database access methods including CRUD operations,
 * pagination, and custom queries for inventory queries.
 * Extends JpaRepository for standard ORM functionality.
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
public interface ProductRepository extends JpaRepository<Product, Long> {

    /**
     * Retrieves products with stock quantity below threshold.
     * 
     * Used to identify low-stock items requiring reorder.
     * Threshold (default 5) is a business constant.
     * 
     * @param threshold quantity boundary (exclusive)
     * @return list of products where quantity < threshold
     */
    @Query("SELECT p FROM Product p WHERE p.quantity < :threshold")
    List<Product> findByQuantityLessThan(@Param("threshold") int threshold);

    /**
     * Retrieves all products in ascending ID order.
     * 
     * Deterministic ordering for consistent pagination and client lists.
     * Ensures consistent results across API calls.
     * 
     * @return list of all products sorted by ID ascending
     */
    @Query("SELECT p FROM Product p ORDER BY p.id ASC")
    List<Product> findAllOrderById();

    /**
     * Calculates total inventory valuation.
     * 
     * Aggregate query at database level (more efficient than loading all products).
     * Returns 0.0 if no products exist (COALESCE handles SUM(null) case).
     * Used for financial reporting and business intelligence.
     * 
     * @return sum of all product totalValue fields
     */
    @Query("SELECT COALESCE(SUM(p.totalValue), 0) FROM Product p")
    double calculateTotalStockValue();

    /**
     * Retrieves products with pagination support.
     * 
     * Prevents loading entire table into memory. Respects page and size parameters
     * for efficient large dataset handling.
     * 
     * @param pageable pagination parameters (page, size, sort)
     * @return page of products with metadata
     */
    @Override
    @NonNull
    @Query("SELECT p FROM Product p")
    Page<Product> findAll(@NonNull Pageable pageable);

    /**
     * Searches for products by name substring (case-insensitive).
     * 
     * Example: searching "app" returns "Apple", "APPLICATION", "Pineapple", etc.
     * Implemented by Spring Data; no custom SQL required.
     * 
     * @param name search substring (case-insensitive)
     * @return list of products where name contains substring
     */
    List<Product> findByNameContainingIgnoreCase(String name);
}

