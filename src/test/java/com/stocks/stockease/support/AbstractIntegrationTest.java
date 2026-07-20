package com.stocks.stockease.support;

import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Base class for tests needing a real database; one shared PostgreSQL container
 * serves the whole suite so tests run against the production engine.
 */
public abstract class AbstractIntegrationTest {

    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    static {
        // guard: without it a stopped Docker yields an opaque connection error
        if (!DockerClientFactory.instance().isDockerAvailable()) {
            throw new IllegalStateException(
                    "Docker is not running - integration tests need Docker Desktop. Start Docker and re-run.");
        }
        POSTGRES.start();
    }
}
