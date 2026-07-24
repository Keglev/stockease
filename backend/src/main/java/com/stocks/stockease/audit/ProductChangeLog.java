package com.stocks.stockease.audit;

import java.time.LocalDateTime;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

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

/** Domain entity representing a single field-level audit row, persisted to the {@code product_change_log} table. */
@Data
@Entity
@Table(name = "product_change_log")
@NoArgsConstructor
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class ProductChangeLog {

    /** Unique change log entry identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Product the change was made to. */
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /** Admin or user who made the change. */
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Attribute that changed. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ChangedField field;

    /** Value before the change; {@code null} for lifecycle events that carry no value. */
    @Column(name = "old_value")
    private String oldValue;

    /** Value after the change; {@code null} for lifecycle events that carry no value. */
    @Column(name = "new_value")
    private String newValue;

    /** Timestamp the row was first persisted, populated by JPA auditing. */
    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
