package com.stocks.stockease.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.jspecify.annotations.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * JWT token extraction and validation filter that runs once per request.
 * Validates the Authorization header token, loads user details, and populates the SecurityContext.
 */
@Component
@org.springframework.context.annotation.Profile("!docs")
public class JwtFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtFilter.class);

    private final JwtUtil jwtUtil;

    private final UserDetailsService userDetailsService;

    /**
     * Constructs the filter with JWT utility and user details service dependencies.
     *
     * @param jwtUtil JWT operations utility
     * @param userDetailsService loads user details for authentication
     */
    public JwtFilter(JwtUtil jwtUtil, UserDetailsService userDetailsService) {
        this.jwtUtil = jwtUtil;
        this.userDetailsService = userDetailsService;
    }

    /**
     * Validates the Bearer token from the Authorization header and populates the SecurityContext.
     *
     * @param request HTTP request with optional Authorization header
     * @param response HTTP response
     * @param filterChain next filter in chain
     * @throws java.io.IOException if an I/O error occurs
     * @throws jakarta.servlet.ServletException if a servlet error occurs
     */
    @Override
    protected void doFilterInternal(
        @NonNull jakarta.servlet.http.HttpServletRequest request,
        @NonNull jakarta.servlet.http.HttpServletResponse response,
        @NonNull jakarta.servlet.FilterChain filterChain
    ) throws java.io.IOException, jakarta.servlet.ServletException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);

            if (jwtUtil.validateToken(token)) {
                String username = jwtUtil.extractUsername(token);

                var userDetails = userDetailsService.loadUserByUsername(username);

                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());

                SecurityContextHolder.getContext().setAuthentication(authToken);
            } else {
                log.debug("JWT validation failed for token");
            }
        }
        filterChain.doFilter(request, response);
    }
}
