package com.stocks.stockease.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.model.StockMovement;

/** Spring Data JPA repository for {@link StockMovement} entities. */
public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {
}
