package com.stocks.stockease;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Spring Boot entry point for the StockEase inventory management application.
 */
@SpringBootApplication
public class StockEaseApplication {

    /**
     * Boots the application context. Nothing is configured here on purpose: every setting comes from
     * the profile-specific properties, so the deployed jar and a local run differ only by profile.
     *
     * @param args forwarded to Spring Boot, which reads them as property overrides
     */
    public static void main(String[] args) {
        SpringApplication.run(StockEaseApplication.class, args);
    }
}

