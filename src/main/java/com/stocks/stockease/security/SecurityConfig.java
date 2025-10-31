package com.stocks.stockease.security;

import java.util.Arrays;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

/**
 * Spring Security configuration for StockEase application.
 * 
 * Orchestrates:
 * - Authentication: JWT token-based stateless security
 * - Authorization: Role-based access control (ADMIN, USER)
 * - CORS: Allow local dev frontend and production deployment
 * - Exception handling: Custom 401/403 error responses
 * 
 * Configuration layers:
 * 1. SecurityFilterChain: HTTP security rules and filter ordering
 * 2. PasswordEncoder: BCrypt hashing for credentials
 * 3. AuthenticationManager: Credential validation during login
 * 4. CorsConfiguration: Cross-origin request handling
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    /**
     * JWT filter for extracting and validating tokens in request chain.
     */
    private final JwtFilter jwtFilter;

    /**
     * Custom entry point handler for 401 Unauthorized responses.
     */
    private final AuthenticationEntryPoint customAuthenticationEntryPoint;

    /**
     * Constructs security config with JWT and authentication entry point.
     * 
     * Dependencies injected by Spring for filter chain integration.
     * 
     * @param jwtFilter validates JWT tokens in request headers
     * @param customAuthenticationEntryPoint sends custom 401 error responses
     */
    public SecurityConfig(JwtFilter jwtFilter, AuthenticationEntryPoint customAuthenticationEntryPoint) {
        this.jwtFilter = jwtFilter;
        this.customAuthenticationEntryPoint = customAuthenticationEntryPoint;
    }

    /**
     * Configures password encoder bean for credential hashing.
     * 
     * Uses BCrypt with 10 rounds (default strength, ~0.5s per hash).
     * Applied during:
     * - User registration: hash plain password before storage
     * - Login: hash submitted password and compare with stored hash
     * 
     * @return BCryptPasswordEncoder instance for bean container
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Exposes Spring's default AuthenticationManager as bean.
     * 
     * Used by AuthController during login POST request:
     * 1. Receives username/password from LoginRequest DTO
     * 2. Delegates to AuthenticationManager for credential validation
     * 3. Returns authentication token if credentials valid
     * 4. Throws BadCredentialsException if invalid
     * 
     * @param config Spring Security authentication configuration
     * @return authenticated AuthenticationManager bean
     * @throws Exception if bean creation fails
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    /**
     * Configures HTTP security filter chain for request authorization.
     * 
     * Filter chain order (Spring Security):
     * 1. CorsFilter - allow cross-origin requests
     * 2. JwtFilter - extract and validate token, populate SecurityContext
     * 3. ExceptionHandlingFilter - convert security exceptions to HTTP responses
     * 4. AuthorizationFilter - enforce endpoint authorization rules
     * 5. Controller routing
     * 
     * Authorization rules:
     * - Public: /api/health, /actuator/health/**, /api/auth/login (no auth required)
     * - Admin: POST /api/products, DELETE /api/products/** (ADMIN role only)
     * - Admin+User: PUT /api/products/**, GET /api/products**, (ADMIN or USER role)
     * - Catch-all: anyRequest().authenticated() (deny by default)
     * 
     * Exception handling:
     * - 401 Unauthorized: custom entry point returns JSON error (no token/invalid token)
     * - 403 Forbidden: access denied handler returns JSON error (valid token but insufficient role)
     * 
     * CSRF: Disabled (stateless JWT doesn't need CSRF tokens, no session cookies)
     * Session: Stateless (JWT-based, no JSESSIONID, prevents session fixation attacks)
     * 
     * @param http HttpSecurity builder for fluent configuration
     * @return configured SecurityFilterChain bean
     * @throws Exception if configuration fails
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // Disable CSRF protection (stateless JWT doesn't need CSRF tokens)
            .csrf(csrf -> csrf.disable())
            // Enable CORS with custom configuration
            .cors(cors -> cors.configurationSource(corsConfigurationSource())) // Add CORS configuration
            // Configure endpoint authorization
            .authorizeHttpRequests(auth -> auth

                // Allow public access to health check
                .requestMatchers("/api/health").permitAll()
                // Allow actuator health endpoints and subpaths (GET only) for external health probes
                // e.g. GET /actuator/health, /actuator/health/readiness, /actuator/health/liveness
                .requestMatchers(HttpMethod.GET, "/actuator/health/**").permitAll()

                // Public endpoint for login
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()

                // Admin-specific permissions
                .requestMatchers(HttpMethod.POST, "/api/products").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/products/**").hasAnyRole("ADMIN", "USER")
                .requestMatchers(HttpMethod.DELETE, "/api/products/**").hasRole("ADMIN")

                // User-specific permissions
                .requestMatchers(HttpMethod.GET, "/api/products/**").hasAnyRole("ADMIN", "USER")
                .requestMatchers(HttpMethod.GET, "/api/products").hasAnyRole("ADMIN", "USER")

                // Deny all other requests
                .anyRequest().authenticated()
            )
            // Configure exception handling for authentication/authorization failures
            .exceptionHandling(exceptions -> exceptions
                // Handle 401 Unauthorized (no token or invalid token)
                .authenticationEntryPoint(customAuthenticationEntryPoint)
                // Handle 403 Forbidden (valid token but insufficient role)
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    System.out.println("Access Denied Handler triggered for user: " + request.getUserPrincipal());
                    response.setStatus(HttpStatus.FORBIDDEN.value());
                    response.setContentType("application/json");
                    response.getWriter().write("{\"error\": \"You are not authorized to perform this action.\"}");
                })
            )
            // Stateless session management (no JSESSIONID cookie, JWT-based instead)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // Add JWT filter before standard username/password filter
            // Order: CorsFilter → JwtFilter → authentication checks → controller
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Configures CORS filter bean for Spring container.
     * 
     * Applies CORS headers to all responses matching "/**" path pattern.
     * Used by browser for preflight requests (OPTIONS method).
     * 
     * @return CorsFilter bean registered in Spring container
     */
    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", corsConfiguration());
        return new CorsFilter(source);
    }

    /**
     * Defines CORS policy (allowed origins, methods, headers, credentials).
     * 
     * Allows:
     * - Origins: http://localhost:5173 (dev), https://stockeasefrontend.vercel.app (prod)
     * - Methods: GET, POST, PUT, DELETE, OPTIONS (REST operations + preflight)
     * - Headers: Authorization (JWT token), Cache-Control, Content-Type
     * - Credentials: true (allows cookies alongside tokens if needed)
     * 
     * Prevents CORS errors in browser when frontend calls backend API.
     * 
     * @return CorsConfiguration with policy rules
     */
    private CorsConfiguration corsConfiguration() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(
            "http://localhost:5173",  // Allow local development origin
            "https://stockeasefrontend.vercel.app/" // Allow deployed frontend
        ));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS")); // Allow methods
        config.setAllowedHeaders(Arrays.asList("Authorization", "Cache-Control", "Content-Type")); // Allow headers
        config.setAllowCredentials(true); // Allow cookies and credentials
        return config;
    }

    /**
     * Creates CORS configuration source for security filter chain.
     * 
     * Wraps corsConfiguration() to be compatible with Spring Security's
     * HttpSecurity.cors() method which expects CorsConfigurationSource.
     * 
     * @return URL-based CORS configuration source for "/**" paths
     */
    private UrlBasedCorsConfigurationSource corsConfigurationSource() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", corsConfiguration());
        return source;
    }
}