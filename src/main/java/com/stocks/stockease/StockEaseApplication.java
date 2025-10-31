package com.stocks.stockease;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * StockEase Spring Boot Application entry point.
 * 
 * Bootstraps the StockEase inventory management system with Spring Boot auto-configuration.
 * 
 * Component discovery:
 * - @SpringBootApplication enables auto-configuration, component scanning, and configuration properties
 * - Scans com.stocks.stockease package and subpackages for @Component, @Service, @Repository, @Controller
 * - Registers all beans in Spring context for dependency injection
 * 
 * Initialization sequence:
 * 1. SpringApplication.run() starts embedded Tomcat server
 * 2. Spring loads application.properties (or application-{profile}.properties)
 * 3. FlywayConfiguration bean runs (initMethod="migrate") before JPA initialization
 * 4. Database migrations execute (V*__*.sql files from db/migration/)
 * 5. EntityManagerFactory initializes with migrated schema
 * 6. Controllers, services, repositories become available
 * 7. Application ready for HTTP requests on http://localhost:8080
 * 
 * Profiles:
 * - dev: local development (H2 in-memory DB, debug logging)
 * - test: integration tests (TestConfig bean provides test data)
 * - prod: production deployment (PostgreSQL, minimal logging)
 * 
 * Actuator endpoints (Spring Boot management):
 * - GET /actuator/health - application health status
 * - POST /actuator/shutdown - graceful shutdown (if enabled)
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@SpringBootApplication
public class StockEaseApplication {

    /**
     * Main method - entry point for JVM execution.
     * 
     * Called by JVM when application jar runs:
     * - java -jar stockease-0.0.1-SNAPSHOT.jar [args]
     * - java -jar stockease-0.0.1-SNAPSHOT.jar --spring.profiles.active=prod
     * 
     * Delegates to SpringApplication.run() to start the embedded container
     * and initialize Spring context with all managed beans.
     * 
     * @param args command-line arguments:
     *   - --spring.profiles.active=prod (set active profile)
     *   - --server.port=9000 (override port)
     *   - --logging.level.root=DEBUG (set log level)
     */
    public static void main(String[] args) {
        SpringApplication.run(StockEaseApplication.class, args);
    }
}

