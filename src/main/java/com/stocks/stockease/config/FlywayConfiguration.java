package com.stocks.stockease.config;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Database migration configuration using Flyway.
 * 
 * Problem solved:
 * - Spring Boot 3.5.x with Spring Data JPA causes circular dependency:
 *   EntityManagerFactory wants to validate schema, but migrations haven't run yet
 * - Solution: Manually execute migrations via initMethod before JPA initialization
 * 
 * Migration discovery:
 * - Location: classpath:db/migration/
 * - Naming: V{VERSION}__{DESCRIPTION}.sql (e.g., V1__init_schema.sql)
 * - Execution: Sorted by version number, executed once per database
 * 
 * Features configured:
 * - baselineOnMigrate: Creates baseline if flyway_schema_history table doesn't exist
 * - cleanDisabled: Prevents accidental database wipe (safety for production)
 * - outOfOrder: Allows applying migrations older than current baseline (recovery scenarios)
 * - connectRetries: Retry failed connections (handles slow database startup)
 * 
 * Initialization sequence:
 * 1. Spring creates FlywayConfiguration bean
 * 2. flyway() method invoked (creates Flyway instance)
 * 3. initMethod="migrate" runs immediately (before @RestController beans)
 * 4. Migrations execute in order (V1__, V2__, etc.)
 * 5. EntityManagerFactory initializes with migrated schema
 * 6. Application ready for requests
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@Configuration
@ConditionalOnClass(Flyway.class)
public class FlywayConfiguration {

    /**
     * Property to enable/disable Flyway migrations.
     * Default: true (enabled)
     * Override: spring.flyway.enabled=false (disable in test profile)
     */
    @Value("${spring.flyway.enabled:true}")
    private boolean flywayEnabled;

    /**
     * Creates and executes Flyway migrations immediately during startup.
     * 
     * Why @Primary and initMethod="migrate":
     * - Prevents Spring Data JPA from initializing EntityManagerFactory before migrations run
     * - Executes migrations in constructor (implicit dependency)
     * - Alternative approaches (like @DependsOn) don't guarantee migration order in Spring 3.5.x
     * 
     * Configuration details:
     * - locations: Source migrations from classpath:db/migration/ (V*__*.sql files)
     * - baselineOnMigrate: Create baseline if first migration run (idempotent)
     * - cleanDisabled: Prevent accidental truncate/drop (safety net for production)
     * - outOfOrder: Allow non-sequential migrations (handle backfill scenarios)
     * - connectRetries: Retry 20 times with 2-second intervals (handles serverless DB cold-start)
     * 
     * Flyway profiles:
     * - dev: In-memory H2 database (migrations ephemeral)
     * - test: TestConfig creates separate test database
     * - prod: PostgreSQL (migrations persisted)
     * 
     * @param dataSource Spring-managed DataSource (auto-wired from application.properties)
     * @return Configured Flyway instance (migrations already executed by initMethod)
     * @throws Exception if DataSource connection fails after retries
     */
    @Primary
    @Bean(initMethod = "migrate")
    public Flyway flyway(DataSource dataSource) throws Exception {
        
        // Honor explicit disable flag (useful for test profiles)
        if (!flywayEnabled) {
            return Flyway.configure().dataSource(dataSource).load();
        }

        // Configure Flyway with resilience and safety settings
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration") // Location of V*__*.sql files
                .baselineOnMigrate(true) // Create baseline if schema_history doesn't exist
                .cleanDisabled(true) // Prevent accidental database wipe
                .outOfOrder(true) // Allow non-sequential migrations
                .connectRetries(20) // Retry 20 times (handles slow DB startup)
                .connectRetriesInterval(2) // 2 seconds between retries
                .load();

        // Execute migrations immediately (before other beans initialize)
        // This ensures schema is ready before JPA EntityManagerFactory needs it
        flyway.migrate();
        return flyway;
    }
}
