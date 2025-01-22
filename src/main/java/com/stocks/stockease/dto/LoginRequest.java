package com.stocks.stockease.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * A Data Transfer Object (DTO) representing a login request.
 * This class is used to capture user credentials during authentication.
 */
public class LoginRequest {

    // Username of the user, must not be blank
    @NotBlank(message = "Username cannot be blank")
    private String username;

    // Password of the user, must not be blank
    @NotBlank(message = "Password cannot be blank")
    private String password;

    /**
     * Default constructor for deserialization.
     */
    public LoginRequest() {
    }

    /**
     * Constructs a LoginRequest with the provided username and password.
     * 
     * @param username the username of the user
     * @param password the password of the user
     */
    public LoginRequest(String username, String password) {
        this.username = username;
        this.password = password;
    }

    /**
     * Retrieves the username.
     * 
     * @return the username
     */
    public String getUsername() {
        return username;
    }

    /**
     * Updates the username.
     * 
     * @param username the new username
     */
    public void setUsername(String username) {
        this.username = username;
    }

    /**
     * Retrieves the password.
     * 
     * @return the password
     */
    public String getPassword() {
        return password;
    }

    /**
     * Updates the password.
     * 
     * @param password the new password
     */
    public void setPassword(String password) {
        this.password = password;
    }
}
