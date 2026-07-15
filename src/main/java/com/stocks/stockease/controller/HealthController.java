package com.stocks.stockease.controller;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Database-backed health endpoint used by uptime monitors to keep the Supabase instance active.
 * Intentionally separate from Spring Actuator so it can be exposed publicly without extra configuration.
 */
@RestController
@RequestMapping("/health")
public class HealthController {

    private static final Logger log = LoggerFactory.getLogger(HealthController.class);

    private final JdbcTemplate jdbcTemplate;

    public HealthController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Probes the database with a trivial query and reports combined liveness.
     *
     * @return HTTP 200 with an UP status body on success; HTTP 503 with a DOWN status body otherwise
     */
    @GetMapping
    public ResponseEntity<Map<String, String>> healthCheck() {
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return ResponseEntity.ok(Map.of("status", "UP", "db", "UP"));
        } catch (Exception e) {
            // 503 rather than a 500 signals a transient dependency outage, not an application bug
            log.warn("Database health probe failed", e);
            return ResponseEntity.status(503).body(Map.of("status", "DOWN", "db", "DOWN"));
        }
    }
}
