package com.stocks.stockease.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.model.User;

/**
 * Spring Data JPA repository for User entity persistence.
 * 
 * Provides database access methods for CRUD operations
 * and custom queries for user authentication and authorization.
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Retrieves user by unique username.
     * 
     * Used for authentication during login and user detail loading.
     * Username is unique at database level, so result is deterministic.
     * 
     * @param username user account name to look up
     * @return Optional containing User if found; empty Optional if not found
     */
    Optional<User> findByUsername(String username);
}

