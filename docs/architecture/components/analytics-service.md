# Analytics Service

**Purpose**: Document the current monitoring and observability capabilities of the StockEase backend via Spring Boot Actuator and structured logging.

---

## Spring Boot Actuator Endpoints

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `GET /actuator/health` | Overall health status | Public |
| `GET /actuator/health/liveness` | Application is running | Public |
| `GET /actuator/health/readiness` | Application is ready to accept requests | Public |
| `GET /actuator/env` | Active environment properties | Restricted |
| `GET /actuator/metrics` | Available metric names | Restricted |

---

## Default Metrics

Spring Boot Actuator exposes the following metrics out of the box:

| Metric | Description |
|--------|-------------|
| `jvm.memory.used` | JVM heap memory usage |
| `jvm.threads.live` | Number of active threads |
| `process.cpu.usage` | Container CPU utilization |
| `http.server.requests` | HTTP request count, duration, status |
| `db.connection.active` | Active database connections (HikariCP) |

Access individual metrics at `GET /actuator/metrics/{metric.name}`.

---

## Application Logging

Logs are written to stdout and captured by Koyeb.

**Format**: `[timestamp] [level] [class] message`

**Log levels by environment**:
- Development: `DEBUG` for `com.stocks.stockease`, `INFO` for root
- Production: `INFO` for `com.stocks.stockease`, `WARN` for root

**Example output**:
```
[2025-10-31 10:30:00] INFO  [ProductService] Product created (ID: abc-123)
[2025-10-31 10:30:01] WARN  [AuthService] Failed login attempt for user: john
[2025-10-31 10:30:02] ERROR [Database] Connection timeout
```

---

## Observability Practices

### Structured Logging

Log entries include relevant context rather than bare messages:

```java
// Good — includes actionable context
logger.info("Product created",
    Map.of("productId", id, "userId", userId, "price", price));

// Poor — no context for debugging
logger.info("Product created");
```

### Error Tracking

Exceptions are logged with full context before being translated into safe API responses:

```java
try {
    // business logic
} catch (DatabaseException e) {
    logger.error("Database error creating product", e,
        Map.of("productId", id));
    throw new InternalServerException("Failed to create product", e);
}
```

### Performance Tracing

Critical service methods are timed using Micrometer's `@Timed` annotation:

```java
@Timed(value = "product.search.time", description = "Time to search products")
public Page<ProductDTO> searchProducts(String query) {
    // implementation
}
```

The metric `product.search.time` is then available at `/actuator/metrics/product.search.time`.

---

## Infrastructure Monitoring

Koyeb monitors the container and exposes:
- Service status (HEALTHY / UNHEALTHY)
- Container CPU and memory usage
- Network I/O
- Auto-scaling events

Neon monitors the database and exposes:
- Connection pool usage
- Query performance
- Backup status

Both feed into the health check at `GET /health` which Koyeb polls every 30 seconds. See [Infrastructure](../deployment/infrastructure.md) for health check configuration details.

---

[Back to Components Index](./index.md)
