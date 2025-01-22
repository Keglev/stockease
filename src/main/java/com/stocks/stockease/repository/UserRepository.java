package com.stocks.stockease.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.model.User;

/**
 * Repository interface for managing User entities.
 * Provides methods for CRUD operations and custom queries on the User table.
 */
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Finds a user by their username.
     * 
     * @param username the username to search for
     * @return an Optional containing the User if found, or empty if not found
     */
    Optional<User> findByUsername(String username);
}

