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
 * Security configuration for the StockEase application.
 * This class configures authentication, authorization, and CORS settings.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtFilter jwtFilter;
    private final AuthenticationEntryPoint customAuthenticationEntryPoint;

    /**
     * Constructor for injecting dependencies.
     * 
     * @param jwtFilter the JWT filter for token validation
     * @param customAuthenticationEntryPoint the entry point for unauthorized requests
     */
    public SecurityConfig(JwtFilter jwtFilter, AuthenticationEntryPoint customAuthenticationEntryPoint) {
        this.jwtFilter = jwtFilter;
        this.customAuthenticationEntryPoint = customAuthenticationEntryPoint;
    }

    /**
     * Configures the password encoder bean.
     * 
     * @return a BCryptPasswordEncoder instance
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Configures the authentication manager bean.
     * 
     * @param config the authentication configuration
     * @return the authentication manager
     * @throws Exception if an error occurs while creating the manager
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    /**
     * Configures the security filter chain.
     * 
     * @param http the HttpSecurity object for configuring security
     * @return the configured SecurityFilterChain
     * @throws Exception if an error occurs during configuration
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource())) // Add CORS configuration
            .authorizeHttpRequests(auth -> auth
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
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint(customAuthenticationEntryPoint)
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    System.out.println("Access Denied Handler triggered for user: " + request.getUserPrincipal());
                    response.setStatus(HttpStatus.FORBIDDEN.value());
                    response.setContentType("application/json");
                    response.getWriter().write("{\"error\": \"You are not authorized to perform this action.\"}");
                })
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Configures a CORS filter bean.
     * 
     * @return a CorsFilter instance
     */
    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", corsConfiguration());
        return new CorsFilter(source);
    }

    /**
     * Defines the CORS configuration.
     * 
     * @return the configured CORS settings
     */
    private CorsConfiguration corsConfiguration() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList("http://localhost:5173")); // Allow frontend origin
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS")); // Allow methods
        config.setAllowedHeaders(Arrays.asList("Authorization", "Cache-Control", "Content-Type")); // Allow headers
        config.setAllowCredentials(true); // Allow cookies and credentials
        return config;
    }

    /**
     * Configures the CORS settings for the security filter chain.
     * 
     * @return the source of CORS configurations
     */
    private UrlBasedCorsConfigurationSource corsConfigurationSource() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", corsConfiguration());
        return source;
    }
}
