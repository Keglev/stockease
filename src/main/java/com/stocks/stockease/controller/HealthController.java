package com.stocks.stockease.controller;

import java.sql.Connection;
import java.sql.SQLException;

import javax.sql.DataSource;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Application health check endpoint for orchestration and monitoring.
 * 
 * Used by:
 * - Kubernetes (K8s liveness probes, readiness probes)
 * - Docker (healthcheck instruction)
 * - Load balancers (backend health checks)
 * - Monitoring systems (Prometheus, DataDog, etc.)
 * 
 * Design principles:
 * - Lightweight: Single DB connection validation, no expensive operations
 * - Fast response: ~10ms typical latency (10-second timeout for slow DB startups)
 * - Side-effect free: No state changes, safe to call frequently
 * - Minimal contract: Simple 200 OK or 500 error with short text message
 * 
 * Success criteria:
 * - HTTP 200 OK: Database is reachable and connection valid
 * - HTTP 500 Internal Error: Database unreachable or connection timeout
 * 
 * Endpoint: GET /api/health (public, no authentication required)
 * Disabled in 'docs' profile (no DataSource available)
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@RestController
@RequestMapping("/api/health")
public class HealthController {

    /** Primary JDBC DataSource used by the application. Injected by Spring. */
    private final DataSource dataSource;

    /**
     * Constructor for dependency injection.
     *
     * @param dataSource the JDBC DataSource to check for connectivity
     */
    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    /**
     * Simple health check endpoint for orchestrators and monitoring systems.
     * 
     * Implementation strategy:
     * - Obtains connection from pool (validates JDBC driver is loaded)
     * - Calls Connection.isValid(10) to verify database liveness
     * - 10-second timeout balances startup latency vs probe responsiveness
     * - Handles SQLException for database connection failures
     * 
     * Success response: 200 OK with "Database is connected and API is running."
     * Failure response: 500 Internal Error with diagnostic message
     * 
     * Important: Keep this handler lightweight. Avoid:
     * - SELECT COUNT(*) queries (expensive)
     * - Schema migrations (causes cascading failures)
     * - Logging detailed errors (expose internal state)
     * - Caching responses (defeats real-time health checks)
     *
     * @return ResponseEntity with HTTP 200 on success, 500 on failure
     */
    @GetMapping
    public ResponseEntity<String> healthCheck() {
        // Probe the primary backing service (database). This call is intentionally
        // lightweight and non-destructive: it only validates the connection socket
        // and basic liveness using the JDBC isValid() method.
        try (Connection connection = dataSource.getConnection()) {
            // Bound the liveness check so callers don't wait too long. A short
            // timeout (10s) balances resilience for slow DB startups against probe
            // latency for health check callers.
            if (connection.isValid(10)) {
                return ResponseEntity.ok("Database is connected and API is running.");
            }
        } catch (SQLException e) {
            // Return a concise error message. Avoid returning stack traces or
            // detailed internal state to external callers for security reasons.
            return ResponseEntity.status(500).body("Database is down: " + e.getMessage());
        }

        // Fallback generic error when connection opened but did not validate
        // within the expected bounds. This path is reachable if isValid() returns
        // false for any reason.
        return ResponseEntity.status(500).body("Unknown issue with database connection.");
    }
}
