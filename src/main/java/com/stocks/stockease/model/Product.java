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
 * Entity class representing a product in the inventory system.
 * This class is mapped to the "product" table in the database.
 */
@Data
@Entity
@Table(name = "product")
@NoArgsConstructor
@AllArgsConstructor
public class Product {

    // Primary key for the product entity
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Name of the product (cannot be null)
    @Column(nullable = false)
    private String name;

    // Quantity of the product in stock (cannot be null)
    @Column(nullable = false)
    private Integer quantity;

    // Price of a single unit of the product (cannot be null)
    @Column(nullable = false)
    private Double price;

    // Total value of the product stock (calculated as quantity * price)
    @Column(nullable = false)
    private Double totalValue;

    /**
     * Custom setter for quantity that updates the total value automatically.
     * 
     * @param quantity the new quantity of the product
     */
    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
        updateTotalValue(); // Automatically recalculate totalValue
    }

    /**
     * Custom setter for price that updates the total value automatically.
     * 
     * @param price the new price of the product
     */
    public void setPrice(Double price) {
        this.price = price;
        updateTotalValue(); // Automatically recalculate totalValue
    }

    /**
     * Internal method to update the total value based on the current quantity and price.
     */
    private void updateTotalValue() {
        this.totalValue = (this.quantity != null && this.price != null) ? this.quantity * this.price : 0.0;
    }

    /**
     * Parameterized constructor to create a new product entity without an ID.
     * Useful for creating new entities where the ID is generated automatically.
     * 
     * @param name the name of the product
     * @param quantity the quantity of the product in stock
     * @param price the price of a single unit of the product
     */
    public Product(String name, Integer quantity, Double price) {
        this.name = name;
        this.quantity = quantity;
        this.price = price;
        this.totalValue = (quantity != null && price != null) ? quantity * price : 0.0;
    }
}
