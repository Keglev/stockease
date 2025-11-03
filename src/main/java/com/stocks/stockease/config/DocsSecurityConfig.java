package com.stocks.stockease.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Security configuration for 'docs' profile - disables all security.
 * Only loaded when spring.profiles.active=docs.
 * 
 * Allows unauthenticated access to OpenAPI endpoints for CI/CD documentation generation.
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
}
