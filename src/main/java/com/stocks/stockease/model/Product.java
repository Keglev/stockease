package com.stocks.stockease.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Domain entity representing a product in the inventory system, persisted to the {@code product} table.
 * Maintains a computed {@code totalValue} field that is automatically recalculated whenever {@code quantity} or {@code price} changes.
 */
@Data
@Entity
@Table(name = "product")
@NoArgsConstructor
@AllArgsConstructor
public class Product {

    /** Unique product identifier used for API lookups. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Human-readable product name used for display and search. */
    @Column(nullable = false)
    private String name;

    /** Number of units in stock; triggers a {@code totalValue} recalculation when changed. */
    @Column(nullable = false)
    private Integer quantity;

    /** Unit price of the product; triggers a {@code totalValue} recalculation when changed. */
    @Column(nullable = false)
    private Double price;

    /** Total stock value computed as {@code quantity * price}, maintained automatically by the custom setters. */
    @Column(nullable = false)
    private Double totalValue;

    /**
     * Sets the quantity and recalculates {@code totalValue}.
     *
     * @param quantity new quantity in stock (must be non-negative)
     */
    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
        updateTotalValue();
    }

    /**
     * Sets the unit price and recalculates {@code totalValue}.
     *
     * @param price new unit price (must be positive)
     */
    public void setPrice(Double price) {
        this.price = price;
        updateTotalValue();
    }

    /**
     * Recalculates {@code totalValue} as {@code quantity * price}, defaulting to {@code 0.0} if either field is null.
     */
    private void updateTotalValue() {
        // Prevent null arithmetic; use 0 if either quantity or price is null
        this.totalValue = (this.quantity != null && this.price != null) ? this.quantity * this.price : 0.0;
    }

    /**
     * Creates a product without an ID, computing {@code totalValue} from the given {@code quantity} and {@code price}.
     *
     * @param name product name (required)
     * @param quantity stock quantity (required, non-negative)
     * @param price unit price (required, positive)
     */
    public Product(String name, int quantity, double price) {
        this.name = name;
        this.quantity = quantity;
        this.price = price;
        this.totalValue = quantity * price;
    }
}
