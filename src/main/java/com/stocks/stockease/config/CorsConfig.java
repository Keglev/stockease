package com.stocks.stockease.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Configuration class for Cross-Origin Resource Sharing (CORS).
 * This class customizes the CORS settings to allow the frontend application
 * to interact with the backend API seamlessly.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    /**
     * Configures CORS mappings to allow requests from specified origins
     * with specific methods, headers, and credentials.
     * 
     * @param registry the CorsRegistry object used to customize CORS settings
     */
    @Override
    public void addCorsMappings(@NonNull CorsRegistry registry) {
        registry.addMapping("/**") // Allow all endpoints to be accessed
                .allowedOrigins("http://localhost:5173") // Allow requests from the specified frontend origin
                .allowedMethods("*") // Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
                .allowedHeaders("*") // Allow all headers in the requests
                .allowCredentials(true); // Enable sending cookies or HTTP authentication headers
    }
}

