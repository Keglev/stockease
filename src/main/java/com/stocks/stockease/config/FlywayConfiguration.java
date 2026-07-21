package com.stocks.stockease.config;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.jspecify.annotations.NonNull;

/**
 * Runs Flyway migrations before JPA initializes, resolving a circular dependency
 * in Spring Boot 3.5.x where {@code EntityManagerFactory} tries to validate the schema
 * before migrations have had a chance to create it.
 *
 * <p>Migration scripts live in {@code classpath:db/migration/} and follow the
 * {@code V{VERSION}__{DESCRIPTION}.sql} naming convention (e.g. {@code V1__init_schema.sql}).
 */
@Configuration
@ConditionalOnClass(Flyway.class)
public class FlywayConfiguration {

    // spring.flyway.enabled=false disables migrations (used in test profiles)
    @Value("${spring.flyway.enabled:true}")
    private boolean flywayEnabled;

    /**
     * Creates a {@link Flyway} instance and executes pending migrations immediately.
     *
     * <p>{@code initMethod="migrate"} forces Spring to run migrations <em>before</em>
     * {@code EntityManagerFactory} is created — the only reliable ordering in Spring Boot 3.5.x.
     * {@code @Primary} prevents ambiguity if another {@link Flyway} bean exists on the classpath.
     *
     * @param dataSource the application {@link DataSource} injected by Spring
     * @return the configured {@link Flyway} instance after all pending migrations have run
     * @throws Exception if the {@link DataSource} connection fails after all retries
     */
    @Primary
    @Bean(initMethod = "migrate")
    public Flyway flyway(@NonNull DataSource dataSource) throws Exception {

        if (!flywayEnabled) {
            return Flyway.configure().dataSource(dataSource).load();
        }

        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .cleanDisabled(true)           // prevents accidental database wipe in production
                .outOfOrder(true)
                .connectRetries(20)
                .connectRetriesInterval(2)
                .load();

        flyway.migrate();
        return flyway;
    }
}
