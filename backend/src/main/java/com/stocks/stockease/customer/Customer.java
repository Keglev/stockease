package com.stocks.stockease.customer;

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

/** Domain entity representing a sales customer, persisted to the {@code customer} table. */
@Data
@Entity
@Table(name = "customer")
@NoArgsConstructor
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
@SQLDelete(sql = "UPDATE customer SET deleted_at = now() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
public class Customer {

    /** Unique customer identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Customer display name. */
    @Column(nullable = false)
    private String name;

    /** Customer email address; unique among live customers when present. */
    @Column(length = 255)
    private String email;

    /** Customer phone number. */
    @Column(length = 50)
    private String phone;

    /** Customer postal address. */
    @Column(length = 500)
    private String address;

    /** Customer city. */
    @Column(length = 255)
    private String city;

    /** Timestamp the row was first persisted, populated by JPA auditing. */
    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** Timestamp the row was soft-deleted; {@code null} while still live. */
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;
}
