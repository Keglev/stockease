package com.stocks.stockease.model;

import java.time.LocalDateTime;

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
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Domain entity representing a goods supplier, persisted to the {@code supplier} table. */
@Data
@Entity
@Table(name = "supplier")
@NoArgsConstructor
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
@SQLDelete(sql = "UPDATE supplier SET deleted_at = now() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
public class Supplier {

    /** Unique supplier identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Supplier display name. */
    @Column(nullable = false)
    private String name;

    /** Supplier postal address. */
    @Column(nullable = false)
    private String address;

    /** Timestamp the row was first persisted, populated by JPA auditing. */
    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** Timestamp the row was soft-deleted; {@code null} while still live. */
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;
}
