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
[2025-10-31 10:30:00] INFO  [ProductController] Product created (ID: 3)
[2025-10-31 10:30:01] WARN  [AuthController] Failed login attempt for user: john
[2025-10-31 10:30:02] ERROR [HealthController] Database connection timeout
```

---

## Observability Practices

### Structured Logging

Log entries include relevant context rather than bare messages. Controllers use SLF4J with `LoggerFactory`:

```java
private static final Logger log = LoggerFactory.getLogger(ProductController.class);

// Good — includes actionable context
log.info("Entering deleteProduct method with ID: {}", id);
log.debug("Received request to create product: {}", request);

// Poor — no context for debugging
log.info("Product deleted");
```

### Error Tracking

`GlobalExceptionHandler` centralises error handling — uncaught exceptions are translated into safe `ApiResponse<T>` bodies. Stack traces are never exposed to clients. For debugging, exceptions are available in the application log stream on Koyeb.

### Performance Tracing

Spring Boot Actuator exposes `http.server.requests` metrics (count, duration, status) via `/actuator/metrics/http.server.requests` out of the box — no `@Timed` annotation is required for basic endpoint timing.

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
