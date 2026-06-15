package com.stocks.stockease.config;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.mock;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Tests for {@link FlywayConfiguration} covering the disabled-flyway branch that skips migration.
 */
class FlywayConfigurationTest {

    @Test
    void flyway_whenFlywayDisabled_returnsFlywayInstanceWithoutMigrating() throws Exception {
        FlywayConfiguration config = new FlywayConfiguration();
        // Simulate spring.flyway.enabled=false — the @Value field is not injectable outside a Spring context
        ReflectionTestUtils.setField(config, "flywayEnabled", false);

        // Flyway.load() stores the datasource reference without connecting; a mock is sufficient here
        DataSource dataSource = mock(DataSource.class);

        Flyway result = config.flyway(dataSource);

        assertThat(result).isNotNull();
    }
}
