package com.stocks.stockease.controller;

import org.springframework.beans.factory.annotation.Autowired;
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

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * Controller for handling authentication-related endpoints.
 * This includes login functionality for users.
 */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "Endpoints for user authentication")
public class AuthController {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserRepository userRepository;

    /**
     * Handles user login by authenticating credentials and generating a JWT token.
     * 
     * @param loginRequest the login request payload containing username and password
     * @return a ResponseEntity containing the API response with a JWT token if authentication is successful
     */
    @PostMapping("/login")
    @Operation(
        summary = "User Login",
        description = "Authenticates the user with provided credentials and returns a JWT token."
    )
    public ResponseEntity<ApiResponse<String>> login(@Valid @RequestBody LoginRequest loginRequest) {
        try {
            // Validate request payload
            if (loginRequest.getUsername().isBlank() || loginRequest.getPassword().isBlank()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse<>(false, "Username and password cannot be blank", null));
            }

            // Authenticate user credentials
            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                    loginRequest.getUsername(),
                    loginRequest.getPassword()
                )
            );

            // Check if user exists in the database
            User user = userRepository.findByUsername(loginRequest.getUsername())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

            // Generate a JWT token for the authenticated user
            String token = jwtUtil.generateToken(user.getUsername(), user.getRole());

            return ResponseEntity.ok(new ApiResponse<>(true, "Login successful", token));
        } catch (UsernameNotFoundException e) {
            // Handle case where user is not found
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse<>(false, e.getMessage(), null));
        } catch (org.springframework.security.authentication.BadCredentialsException e) {
            // Handle case where credentials are invalid
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse<>(false, "Invalid username or password", null));
        } catch (Exception e) {
            // Handle any other unexpected exceptions
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiResponse<>(false, "An unexpected error occurred", null));
        }
    }
}
