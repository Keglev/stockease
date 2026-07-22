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
 * Runs Flyway migrations before JPA initializes, so that Hibernate's schema validation
 * ({@code ddl-auto=validate}) never runs against an unmigrated database.
 *
 * <p>Introduced for an initialization-order conflict in Spring Boot 3.5 and retained after
 * the Spring Boot 4 upgrade. Migration scripts live in {@code classpath:db/migration/} and
 * follow the {@code V{VERSION}__{DESCRIPTION}.sql} naming convention
 * (e.g. {@code V1__init_schema.sql}).
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
     * {@code EntityManagerFactory} is created, guaranteeing the schema exists when validation runs.
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
