package com.stocks.stockease.security;

import java.io.IOException;

import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Custom entry point for handling authentication failures (401 Unauthorized).
 * 
 * Implements Spring Security's AuthenticationEntryPoint contract to provide
 * REST-compliant error responses for unauthenticated requests on protected endpoints.
 * 
 * Invoked when:
 * - Request missing Authorization header (no JWT token)
 * - Authorization header present but token invalid/expired
 * - JwtFilter throws authentication exception
 * 
 * Response format:
 * - HTTP 401 Unauthorized status
 * - Content-Type: application/json
 * - Body: {"error": "Invalid username or password"}
 * 
 * Design rationale:
 * - JSON response prevents browser default 401 page (REST-compliant)
 * - Generic error message prevents username enumeration attacks
 * - Single implementation serves all unauthenticated requests
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@Component
public class CustomAuthenticationEntryPoint implements AuthenticationEntryPoint {

    /**
     * Handles unauthenticated request by returning 401 JSON error response.
     * 
     * Called by Spring Security's ExceptionTranslationFilter when
     * AuthenticationException is thrown (e.g., invalid/missing JWT).
     * 
     * Response: {"error": "Invalid username or password"}
     * 
     * Security considerations:
     * - Returns generic error message (doesn't reveal if username exists)
     * - Status 401 standard HTTP code for authentication failures
     * - JSON format allows frontend to parse and handle gracefully
     * - Prevents browser from showing default 401 page
     * 
     * @param request HttpServletRequest that triggered authentication failure
     * @param response HttpServletResponse for writing error
     * @param authException exception that triggered this entry point
     * @throws IOException if response writing fails
     */
    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        // Set HTTP status 401 Unauthorized
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        // Set content type to JSON for REST compliance
        response.setContentType("application/json");
        // Write generic error message (prevents username enumeration attacks)
        response.getWriter().write("{\"error\": \"Invalid username or password\"}");
    }
}
