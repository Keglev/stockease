package com.stocks.stockease.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.lang.NonNull;

import com.stocks.stockease.model.Product;

public interface ProductRepository extends JpaRepository<Product, Long> {
    @Query("SELECT p FROM Product p WHERE p.quantity < :threshold")
    List<Product> findByQuantityLessThan(@Param("threshold") int threshold);

    @Query("SELECT p FROM Product p ORDER BY p.id ASC")
    List<Product> findAllOrderById();

    @Query("SELECT COALESCE(SUM(p.totalValue), 0) FROM Product p")
    double calculateTotalStockValue();

    @Override
    @NonNull
    @Query("SELECT p FROM Product p")
    Page<Product> findAll(@NonNull Pageable pageable);

    List<Product> findByNameContainingIgnoreCase(String name);
}
