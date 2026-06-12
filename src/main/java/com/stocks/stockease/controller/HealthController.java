package com.stocks.stockease.controller;

import java.sql.Connection;
import java.sql.SQLException;

import javax.sql.DataSource;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

/**
 * Lightweight liveness probe for orchestrators and monitoring systems.
 *
 * <p>Performs a single JDBC {@link Connection#isValid} check against the primary
 * {@link DataSource}. Returns HTTP 200 when the database is reachable, HTTP 500 otherwise.
 * Intentionally avoids queries, writes, and schema operations so the probe is safe to
 * call at high frequency (K8s liveness/readiness, load balancers, Docker healthcheck).
 */
@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
public class HealthController {

    private final DataSource dataSource;

    /**
     * Checks database connectivity and reports application liveness.
     *
     * <p>Uses a 10-second timeout on {@link Connection#isValid} to tolerate slow database
     * startups without blocking probes indefinitely. No authentication required.
     *
     * @return HTTP 200 with a status message on success; HTTP 500 with {@code e.getMessage()}
     *         if the connection cannot be established or validated
     */
    @GetMapping
    public ResponseEntity<String> healthCheck() {
        try (Connection connection = dataSource.getConnection()) {
            if (connection.isValid(10)) {
                return ResponseEntity.ok("Database is connected and API is running.");
            }
        } catch (SQLException e) {
            // e.getMessage() exposes enough detail for operators without leaking a full stack trace
            return ResponseEntity.status(500).body("Database is down: " + e.getMessage());
        }

        return ResponseEntity.status(500).body("Unknown issue with database connection.");
    }
}
