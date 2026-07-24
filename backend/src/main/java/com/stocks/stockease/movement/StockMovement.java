package com.stocks.stockease.movement;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import com.stocks.stockease.invoice.InvoiceItem;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.security.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/** Domain entity representing a single quantity change, persisted to the {@code stock_movement} table. */
@Data
@Entity
@Table(name = "stock_movement")
@NoArgsConstructor
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class StockMovement {

    /** Unique movement identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Product whose stock changed. */
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /** Admin or user who triggered the movement. */
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Direction of the change, bound to {@code reason}. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private MovementType type;

    /** Business reason for the change. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private MovementReason reason;

    /** Number of units affected. */
    @Column(nullable = false)
    private Integer quantity;

    /** Invoice line this movement fulfils; required for PURCHASE and RETURNED_TO_SUPPLIER only. */
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_item_id")
    private InvoiceItem invoiceItem;

    /** Revenue snapshot per unit; set only for SOLD and RETURN_FROM_CUSTOMER. */
    @Column(name = "sold_price")
    private BigDecimal soldPrice;

    /** Cost snapshot per unit; set only for NEW_PRODUCT. */
    @Column(name = "unit_cost")
    private BigDecimal unitCost;

    /** Timestamp the row was first persisted, populated by JPA auditing. */
    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
