package com.stocks.stockease.controller;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.stocks.stockease.dto.ApiResponse;
import com.stocks.stockease.dto.LoginRequest;
import com.stocks.stockease.model.User;
import com.stocks.stockease.repository.UserRepository;
import com.stocks.stockease.security.JwtUtil;

import jakarta.validation.Valid;

/**
 * REST controller for authentication operations.
 * 
 * Manages user login and JWT token generation for securing API access.
 * Integrates with Spring Security for credential validation and role-based access.
 * Disabled in 'docs' profile (no database/authentication).
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@RestController
@RequestMapping("/api/auth")
@ConditionalOnBean(UserRepository.class)
public class AuthController {

    /**
     * Spring Security AuthenticationManager for credential validation.
     */
    private final AuthenticationManager authenticationManager;

    /**
     * JWT utility for token generation with role claims.
     */
    private final JwtUtil jwtUtil;

    /**
     * Repository for loading user records and roles from database.
     */
    private final UserRepository userRepository;

    /**
     * Constructor for dependency injection via Spring.
     * 
     * @param authenticationManager Spring Security credential validator
     * @param jwtUtil JWT token generator
     * @param userRepository user data access
     */
    public AuthController(AuthenticationManager authenticationManager, JwtUtil jwtUtil, UserRepository userRepository) {
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
    }

    /**
     * Authenticates user credentials and generates JWT token.
     * 
     * Validates username and password against stored user records via Spring Security.
     * Upon successful authentication, issues a signed JWT token with user role embedded
     * for subsequent API request authorization.
     * 
     * @param loginRequest contains username and password
     * @return JWT token wrapped in ApiResponse if authentication succeeds
     * @throws BadCredentialsException if username/password combination is invalid
     * @throws UsernameNotFoundException if user account does not exist
     * @throws org.springframework.validation.BindException if request validation fails
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<String>> login(@Valid @RequestBody LoginRequest loginRequest) {
        try {
            // Validate payload not empty (JSR-303 annotation handles format validation)
            if (loginRequest.getUsername().isBlank() || loginRequest.getPassword().isBlank()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse<>(false, "Username and password cannot be blank", null));
            }

            // Delegate to Spring Security AuthenticationManager for credential verification.
            // Throws BadCredentialsException if password doesn't match stored hash.
            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                    loginRequest.getUsername(),
                    loginRequest.getPassword()
                )
            );

            // Load user details from database for role extraction.
            // Throws UsernameNotFoundException if user record missing (shouldn't happen if auth succeeded).
            User user = userRepository.findByUsername(loginRequest.getUsername())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

            // Generate signed JWT token with username and role claims.
            // Token includes expiration time; client must refresh after expiry.
            String token = jwtUtil.generateToken(user.getUsername(), user.getRole());

            return ResponseEntity.ok(new ApiResponse<>(true, "Login successful", token));
        } catch (UsernameNotFoundException e) {
            // User not found - return 401 Unauthorized with generic message for security.
            // Avoid disclosing whether username exists (prevents user enumeration attacks).
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse<>(false, e.getMessage(), null));
        } catch (org.springframework.security.authentication.BadCredentialsException e) {
            // Invalid credentials (wrong password) - return 401 with generic message.
            // Do NOT reveal which part (username/password) was incorrect.
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse<>(false, "Invalid username or password", null));
        } catch (RuntimeException e) {
            // Catch unexpected server-side errors (e.g., database connection failures).
            // Return 500 Internal Server Error with generic message to avoid information leakage.
            // Stack trace is logged by GlobalExceptionHandler for debugging purposes.
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiResponse<>(false, "An unexpected error occurred", null));
        }
    }
}
