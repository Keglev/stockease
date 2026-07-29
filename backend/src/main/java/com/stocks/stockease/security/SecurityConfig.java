package com.stocks.stockease.security;

import java.util.List;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
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
import org.jspecify.annotations.NonNull;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Spring Security configuration defining authentication, authorization, CORS, and session policies.
 * Uses stateless JWT-based authentication with role-based access control.
 */
@Configuration
@EnableMethodSecurity
@org.springframework.context.annotation.Profile("!docs")
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    private final AuthenticationEntryPoint customAuthenticationEntryPoint;

    private final List<String> allowedOrigins;

    private final List<PublicEndpoint> publicEndpoints;

    /**
     * Constructs security config with the JWT filter, custom authentication entry point, and CORS origins.
     *
     * @param jwtFilter validates JWT tokens in request headers
     * @param customAuthenticationEntryPoint sends custom 401 error responses
     * @param allowedOrigins frontend origins permitted to call the API
     * @param publicEndpoints unauthenticated entry points contributed by other modules; empty when none
     *        of them is active
     */
    public SecurityConfig(JwtFilter jwtFilter, AuthenticationEntryPoint customAuthenticationEntryPoint,
            @Value("${app.cors.allowed-origins}") List<String> allowedOrigins,
            ObjectProvider<PublicEndpoint> publicEndpoints) {
        this.jwtFilter = jwtFilter;
        this.customAuthenticationEntryPoint = customAuthenticationEntryPoint;
        this.allowedOrigins = allowedOrigins;
        // ObjectProvider rather than List injection: with no contributing module active there is no
        // candidate bean at all, and a required List parameter would fail the context start.
        this.publicEndpoints = publicEndpoints.orderedStream().toList();
    }

    /**
     * Returns a BCrypt password encoder bean for credential hashing.
     *
     * @return BCryptPasswordEncoder instance
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Exposes Spring's default AuthenticationManager as a bean for login credential validation.
     *
     * @param config Spring Security authentication configuration
     * @return AuthenticationManager bean
     * @throws Exception if bean creation fails
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    /**
     * Configures the HTTP security filter chain with authorization rules, CORS, and exception handling.
     *
     * @param http HttpSecurity builder
     * @return configured SecurityFilterChain bean
     * @throws Exception if configuration fails
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // Disabled: stateless JWT authentication does not require CSRF tokens
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .authorizeHttpRequests(auth -> {
                auth.requestMatchers("/api/health").permitAll();
                auth.requestMatchers("/health", "/health/").permitAll();
                auth.requestMatchers(HttpMethod.GET, "/actuator/health/**").permitAll();
                auth.requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll();
                // contributed exemptions come before the catch-all so they actually take effect; the
                // list is empty unless a module that publishes one is active
                publicEndpoints.forEach(
                        endpoint -> auth.requestMatchers(endpoint.method(), endpoint.pattern()).permitAll());
                // endpoint authorization lives on the controller methods (@PreAuthorize); the catch-all
                // keeps everything authenticated
                auth.anyRequest().authenticated();
            })
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint(customAuthenticationEntryPoint)
                .accessDeniedHandler((request, response, accessDeniedException) -> {
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
     * Defines CORS policy with allowed origins, methods, headers, and credentials.
     *
     * @return CorsConfiguration with policy rules
     */
    private @NonNull CorsConfiguration corsConfiguration() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Cache-Control", "Content-Type"));
        config.setAllowCredentials(true);
        return config;
    }

    /**
     * Returns a CORS configuration source wrapping the CORS policy for use by the security filter chain.
     *
     * @return URL-based CORS configuration source applied to all paths
     */
    private UrlBasedCorsConfigurationSource corsConfigurationSource() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", corsConfiguration());
        return source;
    }
}
