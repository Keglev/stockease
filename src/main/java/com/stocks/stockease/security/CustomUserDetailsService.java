package com.stocks.stockease.security;

import java.util.Collections;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.stocks.stockease.model.User;
import com.stocks.stockease.repository.UserRepository;

/**
 * Custom UserDetailsService implementation for Spring Security authentication.
 * 
 * Bridges StockEase User domain model with Spring Security's UserDetails contract.
 * Invoked by AuthenticationManager during login flow to load user authorities.
 * 
 * Integration points:
 * - Called by AuthenticationManager during credential validation
 * - Loads User from database by username
 * - Converts role string to Spring Security GrantedAuthority
 * - Returns UserDetails with populated username, password, and authorities
 * 
 * Exception handling:
 * - Throws UsernameNotFoundException if user not found (triggers 401 Unauthorized)
 * Disabled in 'docs' profile for CI/CD documentation generation.
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@Service
@org.springframework.context.annotation.Profile("!docs")
public class CustomUserDetailsService implements UserDetailsService {

    /**
     * Repository for accessing User entities from database.
     */
    private final UserRepository userRepository;

    /**
     * Constructor for dependency injection.
     * 
     * @param userRepository repository for user data access
     */
    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Loads user details by username for Spring Security authentication.
     * 
     * Execution flow:
     * 1. Query database for User by username
     * 2. If not found: throw UsernameNotFoundException (triggers 401 response)
     * 3. Convert domain User to Spring UserDetails:
     *    - Username: from User entity
     *    - Password: BCrypt-encoded hash (never plaintext)
     *    - Authorities: Role (ADMIN or USER) wrapped as GrantedAuthority
     * 4. Return to AuthenticationManager for credential comparison
     * 
     * @param username the username to look up
     * @return Spring Security UserDetails (username, password, authorities)
     * @throws UsernameNotFoundException if user not found in database
     */
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // Query database for User entity by username
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with username: " + username));

        // Convert User domain model to Spring Security UserDetails
        // Password is already BCrypt-encoded in database, AuthenticationManager will hash submitted password and compare
        return new org.springframework.security.core.userdetails.User(
                    user.getUsername(),
                    user.getPassword(), // BCrypt-encoded password hash (from database)
                    Collections.singletonList(new SimpleGrantedAuthority(user.getRole())) // Convert role to authority
        );
    }
}