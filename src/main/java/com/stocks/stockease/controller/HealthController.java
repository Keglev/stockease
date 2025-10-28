package com.stocks.stockease.controller;

import java.sql.Connection;
import java.sql.SQLException;

import javax.sql.DataSource;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final DataSource dataSource;

    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping
    public ResponseEntity<String> healthCheck() {
        // Check if the database is responding
        try (Connection connection = dataSource.getConnection()) {
            // Wait up to 10 seconds for the database to respond (helps when DB is waking)
            if (connection.isValid(10)) {
                return ResponseEntity.ok("Database is connected and API is running.");
            }
        } catch (SQLException e) {
            return ResponseEntity.status(500).body("Database is down: " + e.getMessage());
        }

        return ResponseEntity.status(500).body("Unknown issue with database connection.");
    }
}
