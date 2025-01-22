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
 * Repository interface for managing Product entities.
 * Provides methods for CRUD operations and custom queries on the Product table.
 */
public interface ProductRepository extends JpaRepository<Product, Long> {

    /**
     * Finds all products with a quantity less than the specified threshold.
     * 
     * @param threshold the maximum quantity to filter by
     * @return a list of products with quantities below the threshold
     */
    @Query("SELECT p FROM Product p WHERE p.quantity < :threshold")
    List<Product> findByQuantityLessThan(@Param("threshold") int threshold);

    /**
     * Retrieves all products sorted by their ID in ascending order.
     * 
     * @return a list of products ordered by ID
     */
    @Query("SELECT p FROM Product p ORDER BY p.id ASC")
    List<Product> findAllOrderById();

    /**
     * Calculates the total stock value of all products.
     * 
     * @return the sum of the total value of all products
     */
    @Query("SELECT COALESCE(SUM(p.totalValue), 0) FROM Product p")
    double calculateTotalStockValue();

    /**
     * Retrieves all products in a paginated format.
     * 
     * @param pageable the pagination information
     * @return a page of products
     */
    @Override
    @NonNull
    @Query("SELECT p FROM Product p")
    Page<Product> findAll(@NonNull Pageable pageable);

    /**
     * Searches for products whose names contain the given string (case-insensitive).
     * 
     * @param name the substring to search for in product names
     * @return a list of matching products
     */
    List<Product> findByNameContainingIgnoreCase(String name);
}

