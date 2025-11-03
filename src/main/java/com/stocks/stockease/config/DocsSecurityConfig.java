package com.stocks.stockease.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Security configuration for 'docs' profile - disables all security.
 * Only loaded when spring.profiles.active=docs.
 * 
 * Allows unauthenticated access to OpenAPI endpoints for CI/CD documentation generation.
 * Provides minimal security beans to allow controller scanning.
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-11-03
 */
@Configuration
@EnableWebSecurity
@ConditionalOnProperty(name = "spring.profiles.active", havingValue = "docs")
public class DocsSecurityConfig {

    /**
     * Disable all security for docs profile.
     * 
     * @param http HTTP security builder
     * @return unsecured filter chain
     * @throws Exception if configuration fails
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
            .csrf(csrf -> csrf.disable())
            .httpBasic(basic -> basic.disable());
        return http.build();
    }

    /**
     * Provide dummy AuthenticationManager for controllers to be scanned.
     * Uses a stub UserDetailsService that is provided by DocsBeansConfig.
     * Not actually used since all requests are permitted.
     * 
     * @return authentication manager
     */
    @Bean
    public AuthenticationManager authenticationManager() {
        // Create a minimal DaoAuthenticationProvider without a service
        // This allows the bean to exist for controller scanning
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setPasswordEncoder(passwordEncoder());
        return new ProviderManager(provider);
    }

    /**
     * Provide password encoder for authentication.
     * 
     * @return BCrypt password encoder
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
