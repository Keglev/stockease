package com.stocks.stockease.security.internal;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.stocks.stockease.security.User;

/**
 * Spring Data JPA repository for {@link User} entities, used for authentication and user management.
 */
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Looks up a user by their unique username, used during authentication.
     *
     * @param username user account name to look up
     * @return Optional containing User if found; empty Optional if not found
     */
    Optional<User> findByUsername(String username);
}

