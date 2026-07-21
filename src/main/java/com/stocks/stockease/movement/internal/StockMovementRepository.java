package com.stocks.stockease.movement.internal;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.movement.StockMovement;

/** Spring Data JPA repository for {@link StockMovement} entities. */
public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {
}
