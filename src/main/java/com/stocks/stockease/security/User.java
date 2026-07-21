package com.stocks.stockease.security;

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
 * Domain entity representing a user account, persisted to the {@code app_user} table.
 * The {@code username} field carries a unique database constraint to prevent duplicate accounts.
 */
@Data
@Entity
@Table(name = "app_user")
@NoArgsConstructor
@AllArgsConstructor
public class User {

    /** Unique user identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Login name used for authentication and displayed in API responses. */
    @Column(nullable = false, unique = true)
    private String username;

    /** BCrypt-hashed password; never exposed in API responses or logs. */
    @Column(nullable = false)
    private String password;

    /** Authorization role ({@code ADMIN} or {@code USER}) that determines endpoint access permissions. */
    @Column(nullable = false)
    private String role;

    /**
     * Creates a user without an ID; the {@code password} argument must already be BCrypt-hashed.
     *
     * @param username unique login name (required)
     * @param password BCrypt-hashed password (required, never plaintext)
     * @param role authorization role (required, ADMIN or USER)
     */
    public User(String username, String password, String role) {
        this.username = username;
        this.password = password;
        this.role = role;
    }
}
