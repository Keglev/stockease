package com.stocks.stockease.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * WebMvcConfigurer for Cross-Origin Resource Sharing (CORS) policy.
 * 
 * Problem solved:
 * - Browsers block requests from frontend (http://localhost:5173) to backend API
 * - Solution: Configure CORS headers to allow cross-origin requests
 * 
 * Configuration applied:
 * - Path pattern: //** (all endpoints)
 * - Allowed origins: localhost:5173 (dev), stockeasefrontend.vercel.app (prod)
 * - Allowed methods: GET, POST, PUT, DELETE, OPTIONS (REST operations + preflight)
 * - Allowed headers: * (all headers, especially Authorization for JWT)
 * - Credentials: true (allows cookies, JWT tokens in headers)
 * 
 * Note: SecurityConfig also has CorsConfiguration via SecurityFilterChain.
 * Both work together:
 * - This config: WebMvc level (servlet filter chain)
 * - SecurityConfig: Spring Security level (filter chain)
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    /**
     * Configures CORS mappings for all REST endpoints.
     * 
     * CORS flow (browser perspective):
     * 1. Browser makes preflight OPTIONS request with:
     *    - Origin: http://localhost:5173
     *    - Access-Control-Request-Method: POST
     * 2. Server responds with Access-Control-Allow-* headers
     * 3. Browser validates response and allows/blocks actual request
     * 4. Actual POST/GET/PUT/DELETE request sent with credentials
     * 
     * Allowed origins:
     * - http://localhost:5173: Local dev frontend (Vite server)
     * - https://stockeasefrontend.vercel.app/: Production deployment (Vercel)
     * 
     * @param registry CorsRegistry for fluent configuration
     */
    @Override
    public void addCorsMappings(@NonNull CorsRegistry registry) {
        registry.addMapping("/**") // Apply to all endpoints
                .allowedOrigins(
                    "https://stockeasefrontend.vercel.app/", // Production frontend
                    "http://localhost:5173") // Development frontend (Vite)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS") // REST + preflight
                .allowedHeaders("*") // Allow all headers (Authorization, Content-Type, etc.)
                .allowCredentials(true); // Allow cookies and authentication headers
    }
}

