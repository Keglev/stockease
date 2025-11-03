package com.stocks.stockease.security;

import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * JWT token extraction and validation filter.
 * 
 * Spring Security filter that runs once per request. Extracts JWT token from
 * Authorization header, validates signature/expiration, loads user details,
 * and populates SecurityContext for authorization checks on protected endpoints.
 * 
 * Filter chain position: Early in chain (before controller execution).
 * Bypass: Public endpoints (login, health checks) via SecurityConfig.
 * Disabled in 'docs' profile for CI/CD documentation generation.
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@Component
@org.springframework.context.annotation.Profile("!docs")
public class JwtFilter extends OncePerRequestFilter {

    /**
     * JWT utility for token validation and claims extraction.
     */
    private final JwtUtil jwtUtil;

    /**
     * Spring Security UserDetailsService for loading user authorities.
     * Implementation: CustomUserDetailsService (loads from UserRepository).
     */
    private final UserDetailsService userDetailsService;

    /**
     * Constructs filter with dependencies.
     * 
     * @param jwtUtil JWT operations utility
     * @param userDetailsService loads user details for authentication
     */
    public JwtFilter(JwtUtil jwtUtil, UserDetailsService userDetailsService) {
        this.jwtUtil = jwtUtil;
        this.userDetailsService = userDetailsService;
    }

    /**
     * Processes request to validate JWT and populate security context.
     * 
     * Flow:
     * 1. Extract "Authorization: Bearer <token>" header
     * 2. Validate token signature and expiration
     * 3. Extract username and role from token claims
     * 4. Load user details (authorities/roles) from database
     * 5. Create UsernamePasswordAuthenticationToken
     * 6. Store in SecurityContext for downstream @PreAuthorize checks
     * 7. Continue filter chain
     * 
     * If no token or validation fails, request continues without authentication
     * (handled by explicit @PreAuthorize or global security config).
     * 
     * @param request HTTP request with optional Authorization header
     * @param response HTTP response
     * @param filterChain next filter in chain
     * @throws java.io.IOException if I/O error
     * @throws jakarta.servlet.ServletException if servlet error
     */
    @Override
    protected void doFilterInternal(
        @NonNull jakarta.servlet.http.HttpServletRequest request,
        @NonNull jakarta.servlet.http.HttpServletResponse response,
        @NonNull jakarta.servlet.FilterChain filterChain
    ) throws java.io.IOException, jakarta.servlet.ServletException {

        // Extract Authorization header (format: "Bearer <token>")
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            // Extract token by removing "Bearer " prefix (7 characters)
            String token = authHeader.substring(7);

            // Validate token: signature verification and expiration check
            if (jwtUtil.validateToken(token)) {
                // Extract username from JWT "sub" claim
                String username = jwtUtil.extractUsername(token);

                // Extract role from JWT custom "role" claim
                String role = jwtUtil.extractRole(token);
                // DEBUG: Log extracted role for troubleshooting (remove in production for performance)
                System.out.println("Token role: " + role);

                // Load user details from database (including authorities for @PreAuthorize)
                // CustomUserDetailsService maps role to Spring Security authorities (ROLE_ADMIN, ROLE_USER)
                var userDetails = userDetailsService.loadUserByUsername(username);

                // Create authentication token with user details and authorities
                // No credentials in token (already authenticated by JWT signature)
                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());

                // Store authentication in SecurityContext (available to @PreAuthorize, etc.)
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }
        // Continue filter chain regardless of authentication success
        // Unauthenticated requests will be rejected by @PreAuthorize on protected endpoints
        filterChain.doFilter(request, response);
    }
}
