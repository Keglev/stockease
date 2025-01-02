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

@Data
@Entity
@Table(name = "product")
@NoArgsConstructor
@AllArgsConstructor
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private Double price;

    @Column(nullable = false)
    private Double totalValue;

   // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public Double getPrice() {
        return price;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
        updateTotalValue(); // Automatically recalculate totalValue
    }
    
    public void setPrice(Double price) {
        this.price = price;
        updateTotalValue(); // Automatically recalculate totalValue
    }
    
    // Internal method to update total value
    private void updateTotalValue() {
        this.totalValue = (this.quantity != null && this.price != null) ? this.quantity * this.price : 0.0;
    }
    
    
     // Parameterized constructor (excluding ID for new entities)
    public Product(String name, Integer quantity, Double price) {
        this.name = name;
        this.quantity = quantity;
        this.price = price;
        this.totalValue = quantity * price; // Automatically set totalValue based on quantity and price
    }
}
