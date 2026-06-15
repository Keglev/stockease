package com.stocks.stockease.controller;

import java.sql.Connection;
import java.sql.SQLException;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

/**
 * Tests for {@link HealthController} covering all branch paths of the database liveness probe.
 */
@ExtendWith(MockitoExtension.class)
class HealthControllerTest {

    @Mock
    private DataSource dataSource;

    private HealthController controller;

    @SuppressWarnings("unused") // invoked by JUnit via reflection, not by direct call
    @BeforeEach
    void setUp() {
        controller = new HealthController(dataSource);
    }

    @Test
    void healthCheck_whenConnectionIsValid_returns200() throws Exception {
        Connection connection = mock(Connection.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(10)).thenReturn(true);

        ResponseEntity<String> response = controller.healthCheck();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo("Database is connected and API is running.");
    }

    @Test
    void healthCheck_whenConnectionIsNotValid_returns500WithUnknownMessage() throws Exception {
        Connection connection = mock(Connection.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(10)).thenReturn(false);

        ResponseEntity<String> response = controller.healthCheck();

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(response.getBody()).isEqualTo("Unknown issue with database connection.");
    }

    @Test
    void healthCheck_whenGetConnectionThrowsSQLException_returns500WithErrorMessage() throws Exception {
        when(dataSource.getConnection()).thenThrow(new SQLException("connection refused"));

        ResponseEntity<String> response = controller.healthCheck();

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(response.getBody()).isEqualTo("Database is down: connection refused");
    }
}
