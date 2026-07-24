package com.stocks.stockease.shared.web;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Tests for {@link HealthController} covering the database liveness probe's success and failure paths.
 */
@ExtendWith(MockitoExtension.class)
class HealthControllerTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    private HealthController controller;

    @SuppressWarnings("unused") // invoked by JUnit via reflection, not by direct call
    @BeforeEach
    void setUp() {
        controller = new HealthController(jdbcTemplate);
    }

    @Test
    void healthCheck_whenProbeSucceeds_returns200WithUpStatus() {
        when(jdbcTemplate.queryForObject("SELECT 1", Integer.class)).thenReturn(1);

        ResponseEntity<Map<String, String>> response = controller.healthCheck();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo(Map.of("status", "UP", "db", "UP"));
    }

    @Test
    void healthCheck_whenProbeThrows_returns503WithDownStatus() {
        when(jdbcTemplate.queryForObject("SELECT 1", Integer.class))
            .thenThrow(new RuntimeException("connection refused"));

        ResponseEntity<Map<String, String>> response = controller.healthCheck();

        assertThat(response.getStatusCode().value()).isEqualTo(503);
        assertThat(response.getBody()).isEqualTo(Map.of("status", "DOWN", "db", "DOWN"));
    }
}
