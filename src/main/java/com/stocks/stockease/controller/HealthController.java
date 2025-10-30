package com.stocks.stockease.controller;

import java.sql.Connection;
import java.sql.SQLException;

import javax.sql.DataSource;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * HealthController
 * <p>
 * Lightweight health endpoint used by orchestrators and load balancers to verify
 * application readiness and basic connectivity to critical backing services.
 * This controller intentionally keeps its contract tiny (simple 200/5xx string
 * responses) so external systems can reliably interpret health status.
 * </p>
 *
 * Contract (inputs/outputs):
 * - GET /api/health -> 200 OK with a short text message when the application and
 *   its primary dependencies (currently the configured {@code DataSource}) are
 *   reachable. 500 on error with a human-readable message.
 *
 * Success criteria:
 * - The endpoint returns 200 if a DB connection validates within a short timeout.
 *
 * Error modes:
 * - Database connectivity failure -> 500 with brief diagnostic text.
 * - Unexpected/unknown failure -> 500 with generic message.
 *
 * Operational notes:
 * - Keep this handler fast and side-effect free. Do not perform expensive queries
 *   or schema migrations here. This endpoint should be safe to call frequently.
 * - We use {@link java.sql.Connection#isValid(int)} with a bounded timeout to help
 *   detect databases that are still cold-starting (serverless databases that sleep).
 */
@RestController
@RequestMapping("/api/health")
public class HealthController {

    /** Primary JDBC DataSource used by the application. Injected by Spring. */
    private final DataSource dataSource;

    /**
     * Constructor.
     *
     * @param dataSource the JDBC DataSource to check for connectivity
     */
    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    /**
     * Simple health check endpoint.
     *
     * Implementation details:
     * - Opens a short-lived connection and calls {@code Connection.isValid(10)} to
     *   verify liveness. The 10-second timeout is a conservative bound that helps
     *   in environments where the DB may be slow to wake (serverless providers).
     * - Returns 200 with a concise success string when healthy.
     * - Returns 500 with a brief diagnostic message when the DB is unreachable or
     *   an SQLException occurs.
     *
     * Keep the response payload small to avoid exposing sensitive internal state.
     *
     * @return ResponseEntity with HTTP 200 on success, or 500 on failure.
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
