package com.stocks.stockease.config;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Manages Flyway database migrations with explicit initialization order.
 * 
 * Ensures migrations execute before JPA EntityManagerFactory initialization,
 * preventing circular dependency errors in Spring Boot 3.5.x with Spring Data JPA.
 * Supports SQL (V*__*.sql) and Java-based (V*__*.java) migrations.
 */
@Configuration
@ConditionalOnClass(Flyway.class)
public class FlywayConfiguration {

    @Value("${spring.flyway.enabled:true}")
    private boolean flywayEnabled;

    /**
     * Creates primary Flyway bean with manual migration execution.
     * Executes immediately via initMethod to prevent circular dependency with JPA.
     * 
     * @param dataSource Spring-managed datasource (auto-wired)
     * @return Configured Flyway instance with migrations executed
     */
    @Primary
    @Bean(initMethod = "migrate")
    public Flyway flyway(DataSource dataSource) throws Exception {
        
        if (!flywayEnabled) {
            return Flyway.configure().dataSource(dataSource).load();
        }

        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .cleanDisabled(true)
                .outOfOrder(true)
                .connectRetries(10)
                .connectRetriesInterval(1)
                .load();

        flyway.migrate();
        return flyway;
    }
}
