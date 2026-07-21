package com.stocks.stockease.config;

import org.springframework.context.annotation.Configuration;
import org.jspecify.annotations.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * WebMVC-level CORS policy allowing the frontend origins to reach the API.
 *
 * <p>Works alongside {@code SecurityConfig}, which enforces CORS at the Spring Security
 * filter level. Both layers must agree for preflight and credentialed requests to pass.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    /**
     * Registers CORS rules for every endpoint in the application.
     *
     * <p>{@code allowCredentials(true)} is required so the browser forwards the
     * {@code Authorization} header carrying the JWT on credentialed requests.
     *
     * @param registry Spring MVC registry that accumulates CORS mappings
     */
    @Override
    public void addCorsMappings(@NonNull CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins(
                    "https://stockeasefrontend.vercel.app/",
                    "http://localhost:5173")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true); // browser must forward Authorization header for JWT
    }
}
