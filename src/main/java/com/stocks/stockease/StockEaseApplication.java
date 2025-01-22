package com.stocks.stockease;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Main class for the StockEase application.
 * This serves as the entry point for the Spring Boot application.
 */
@SpringBootApplication
public class StockEaseApplication {

    /**
     * The main method that starts the Spring Boot application.
     * 
     * @param args command-line arguments passed during application startup
     */
    public static void main(String[] args) {
        SpringApplication.run(StockEaseApplication.class, args);
    }
}

