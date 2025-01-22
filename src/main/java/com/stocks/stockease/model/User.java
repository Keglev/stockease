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
 * Entity class representing a user in the system.
 * This class is mapped to the "app_user" table in the database.
 */
@Data
@Entity
@Table(name = "app_user")
@NoArgsConstructor
@AllArgsConstructor
public class User {

    // Primary key for the user entity
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Unique username for the user (cannot be null)
    @Column(nullable = false, unique = true)
    private String username;

    // Encrypted password for the user (cannot be null)
    @Column(nullable = false)
    private String password;

    // Role assigned to the user, e.g., "ADMIN" or "USER" (cannot be null)
    @Column(nullable = false)
    private String role;

    /**
     * Parameterized constructor for creating new user entities without an ID.
     * Useful for creating new entities where the ID is generated automatically.
     * 
     * @param username the unique username of the user
     * @param password the encrypted password of the user
     * @param role the role assigned to the user
     */
    public User(String username, String password, String role) {
        this.username = username;
        this.password = password;
        this.role = role;
    }
}
