package com.stocks.stockease.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Data Transfer Object for user authentication requests.
 * 
 * Encapsulates credentials (username/password) sent to login endpoint.
 * Validation constraints are applied during deserialization to ensure
 * non-empty username and password before processing.
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
public class LoginRequest {

    /**
     * User account name. Required, must not be blank.
     * Validated via JSR-303 annotation during request binding.
     */
    @NotBlank(message = "Username cannot be blank")
    private String username;

    /**
     * User account password. Required, must not be blank.
     * Validated via JSR-303 annotation during request binding.
     * Never logged or exposed in responses (security best practice).
     */
    @NotBlank(message = "Password cannot be blank")
    private String password;

    /**
     * Default no-arg constructor for JSON deserialization.
     */
    public LoginRequest() {
    }

    /**
     * Constructs a login request with username and password.
     * 
     * @param username the user account name
     * @param password the user account password
     */
    public LoginRequest(String username, String password) {
        this.username = username;
        this.password = password;
    }

    /**
     * Returns the username.
     * 
     * @return the username string
     */
    public String getUsername() {
        return username;
    }

    /**
     * Sets the username.
     * 
     * @param username the new username
     */
    public void setUsername(String username) {
        this.username = username;
    }

    /**
     * Returns the password.
     * 
     * @return the password string
     */
    public String getPassword() {
        return password;
    }

    /**
     * Sets the password.
     * 
     * @param password the new password
     */
    public void setPassword(String password) {
        this.password = password;
    }
}
