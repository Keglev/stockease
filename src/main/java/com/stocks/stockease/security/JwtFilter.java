package com.stocks.stockease.security;

import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * A custom filter that validates and processes JWT tokens for authentication.
 * This filter runs once per request and integrates with Spring Security.
 */
@Component
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;

    /**
     * Constructor for injecting dependencies.
     *
     * @param jwtUtil the utility class for JWT operations
     * @param userDetailsService the service to load user details from the database
     */
    public JwtFilter(JwtUtil jwtUtil, UserDetailsService userDetailsService) {
        this.jwtUtil = jwtUtil;
        this.userDetailsService = userDetailsService;
    }

    /**
     * Filters incoming requests to validate JWT tokens and set the authentication context.
     * * Swagger UI and OpenAPI documentation endpoints are bypassed for authentication.
     *
     * @param request the HTTP request
     * @param response the HTTP response
     * @param filterChain the filter chain to pass the request and response to the next filter
     * @throws java.io.IOException if an input/output error occurs during request processing
     * @throws jakarta.servlet.ServletException if an error occurs during request processing
     */

    @Override
    protected void doFilterInternal(
        @NonNull jakarta.servlet.http.HttpServletRequest request,
        @NonNull jakarta.servlet.http.HttpServletResponse response,
        @NonNull jakarta.servlet.FilterChain filterChain
    ) throws java.io.IOException, jakarta.servlet.ServletException {

        // Extract the Authorization header
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7); // Extract the token after "Bearer "

            if (jwtUtil.validateToken(token)) {
                // Extract the username from the token
                String username = jwtUtil.extractUsername(token);

                // Extract the role for debugging (optional for production)
                String role = jwtUtil.extractRole(token);
                System.out.println("Token role: " + role); // Debugging purpose

                // Load the user details and authenticate
                var userDetails = userDetailsService.loadUserByUsername(username);

                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());

                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }
        filterChain.doFilter(request, response); // Continue the filter chain
    }
}
