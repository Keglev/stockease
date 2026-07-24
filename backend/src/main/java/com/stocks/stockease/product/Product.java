package com.stocks.stockease.product;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Domain entity representing a product in the inventory system, persisted to the {@code product} table.
 * {@code totalValue} is computed on read from {@code quantity} and {@code purchasePrice}, never stored.
 */
@Data
@Entity
@Table(name = "product")
@NoArgsConstructor
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
// repository deletes become soft deletes; operational queries
// auto-exclude deleted rows. Reports bypass this via native queries.
@SQLDelete(sql = "UPDATE product SET deleted_at = now() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
public class Product {

    /** Unique product identifier used for API lookups. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Human-readable product name used for display and search. */
    @Column(nullable = false)
    private String name;

    /** Number of units in stock. */
    @Column(nullable = false)
    private Integer quantity;

    /** Unit price of the product, stored as exact decimal money. */
    @Column(nullable = false)
    private BigDecimal purchasePrice;

    /** Stock keeping unit identifier; generated on creation if not supplied. */
    @Column(nullable = false)
    private String sku;

    /** Timestamp the row was first persisted, populated by JPA auditing. */
    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** Timestamp the row was soft-deleted; {@code null} while still live. */
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    /**
     * Creates a product without an ID, converting {@code purchasePrice} to {@link BigDecimal}.
     *
     * @param name product name (required)
     * @param quantity stock quantity (required, non-negative)
     * @param purchasePrice unit price (required, positive)
     */
    public Product(String name, int quantity, double purchasePrice) {
        this.name = name;
        this.quantity = quantity;
        this.purchasePrice = BigDecimal.valueOf(purchasePrice);
    }

    @PrePersist
    private void ensureSku() {
        if (sku == null || sku.isBlank()) {
            // interim generator; real SKU convention arrives with demo data
            sku = "SKU-" + UUID.randomUUID().toString()
                    .substring(0, 8).toUpperCase();
        }
    }

    /**
     * Computes the total stock value as {@code quantity * purchasePrice}; never persisted.
     *
     * @return the product of {@code quantity} and {@code purchasePrice}
     */
    @Transient
    public BigDecimal getTotalValue() {
        return purchasePrice.multiply(BigDecimal.valueOf(quantity));
    }
}
