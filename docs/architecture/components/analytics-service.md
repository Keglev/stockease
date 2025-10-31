# Analytics Service Architecture

## Overview

The Analytics Service (future component) will provide business intelligence and monitoring capabilities for StockEase. This document outlines the planned architecture and design patterns.

## Current Monitoring & Analytics

### Application Metrics (Spring Boot Actuator)

**Enabled Endpoints**:
```
GET /actuator/health
GET /actuator/health/liveness
GET /actuator/health/readiness
GET /actuator/env
GET /actuator/metrics
```

**Default Metrics**:
- `jvm.memory.used` - JVM heap memory usage
- `jvm.threads.live` - Active threads
- `process.cpu.usage` - CPU utilization
- `http.server.requests` - HTTP request metrics
- `db.connection.active` - Active database connections

### Logging

**Application Logs**:
```
Format: [timestamp] [level] [class] message
Destination: stdout (captured by Koyeb)
Levels: DEBUG, INFO, WARN, ERROR

Example:
[2025-10-31 10:30:00] INFO  [ProductService] Product created (ID: ...)
[2025-10-31 10:30:01] WARN  [AuthService] Failed login attempt for user: john
[2025-10-31 10:30:02] ERROR [Database] Connection timeout
```

**Database Audit Logs** (planned):
- User login/logout events
- Product create/update/delete operations
- Authorization failures
- Data modifications

## Future Analytics Components

### 1. Metrics Service

**Purpose**: Collect and aggregate system metrics

**Responsibilities**:
- Collect JVM metrics
- Aggregate HTTP request statistics
- Track database performance
- Monitor API response times

**Endpoints**:
```
GET /analytics/metrics
  - CPU usage
  - Memory usage
  - Request count
  - Error rate
  - Average response time

GET /analytics/metrics/products
  - Total products
  - Products created (last 7 days)
  - Most popular categories
  - Inventory trends

GET /analytics/metrics/users
  - Total users
  - Active users (last 30 days)
  - User growth rate
  - Authentication success rate
```

### 2. Event Logger Service

**Purpose**: Track important business events

**Events to Track**:
- User registration
- User login/logout
- Product created/updated/deleted
- Authorization failures
- High-value transactions
- Data anomalies

**Storage**: PostgreSQL audit table

```sql
CREATE TABLE audit_events (
  id UUID PRIMARY KEY,
  event_type VARCHAR(50),
  user_id UUID,
  entity_type VARCHAR(50),
  entity_id UUID,
  action VARCHAR(20),
  old_values JSONB,
  new_values JSONB,
  timestamp TIMESTAMP,
  ip_address VARCHAR(45)
);
```

### 3. Report Generation Service

**Purpose**: Generate business reports

**Planned Reports**:

#### Inventory Report
```json
{
  "period": "2025-10-01 to 2025-10-31",
  "total_products": 150,
  "total_value": 45000.00,
  "low_stock_items": 12,
  "out_of_stock_items": 3,
  "top_categories": [
    { "category": "electronics", "count": 45, "value": 25000 },
    { "category": "furniture", "count": 32, "value": 12000 }
  ]
}
```

#### User Activity Report
```json
{
  "period": "2025-10-01 to 2025-10-31",
  "total_users": 250,
  "active_users": 180,
  "new_users": 25,
  "most_active_users": [
    { "username": "admin", "actions": 450 },
    { "username": "john", "actions": 320 }
  ]
}
```

#### Performance Report
```json
{
  "period": "2025-10-01 to 2025-10-31",
  "avg_response_time_ms": 125,
  "p95_response_time_ms": 450,
  "error_rate": 0.02,
  "total_requests": 50000,
  "failed_requests": 1000
}
```

### 4. Dashboard Service

**Purpose**: Real-time monitoring dashboard

**Planned Dashboard Components**:
- Key Performance Indicators (KPIs)
- System health status
- Active user count
- Recent transactions
- Error rate trends
- Response time trends

## Monitoring Strategy

### Application Monitoring

**Health Checks**:
- Database connectivity every 30 seconds
- API endpoint responsiveness
- Memory usage alerts if >85%
- Disk space alerts if <10%

**Metrics Collection**:
- Request/response times
- Error rates and types
- Database query performance
- Cache hit rates (future)

### Infrastructure Monitoring

**Koyeb Monitoring**:
- Service status (HEALTHY/UNHEALTHY)
- Container CPU/memory usage
- Network I/O
- Auto-scaling events

**Database Monitoring (Neon)**:
- Connection pool usage
- Query performance
- Backup status
- Replication lag

### Alerting

**Alert Conditions**:
- Health check failure → Page team immediately
- Error rate >5% → Warning
- Response time >500ms avg → Investigation
- Database connection pool exhaustion → Critical
- Disk space <5% → Critical

## Current Test Coverage & Metrics

### Test Statistics
- Total tests: 65+
- Pass rate: 100%
- Coverage target: >80%
- Execution time: <1 minute

### Test Categories
- Unit tests: AuthService, ProductService (30+ tests)
- Controller tests: API endpoints, error handling (15+ tests)
- Integration tests: Database, migrations (10+ tests)
- Security tests: JWT, authorization (10+ tests)

## Performance Optimization Opportunities

### Query Optimization
- Add database indexes on frequently filtered columns
- Implement query result caching
- Use eager loading for relationships
- Paginate large result sets

### Caching Strategy (Future)
- Spring Cache abstraction with Redis
- User session cache
- Product catalog cache
- Category listings cache

### Rate Limiting (Future)
- Implement per-user rate limiting
- API key-based rate limiting
- Exponential backoff for retries

## Observability Best Practices

### Structured Logging
```java
// Good: includes context
logger.info("Product created", 
    Map.of("productId", id, "userId", userId, "price", price));

// Poor: insufficient context
logger.info("Product created");
```

### Error Tracking
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
```java
@Timed(value = "product.search.time", description = "Time to search products")
public Page<ProductDTO> searchProducts(String query) {
    // implementation
}
```

## Integration with CI/CD

### Pre-deployment Checks
- All tests passing
- Code coverage >80%
- No security vulnerabilities
- Build time <5 minutes

### Post-deployment Monitoring
- Service health check
- Smoke tests on production
- Error rate monitoring (first 5 minutes)
- Performance baseline validation

## Future Enhancements

1. **Distributed Tracing** (OpenTelemetry)
   - Trace requests across multiple services
   - Identify bottlenecks
   - Debug issues in production

2. **Advanced Analytics** (ElasticSearch + Kibana)
   - Complex data analysis
   - Historical trend analysis
   - Machine learning predictions

3. **Real-time Alerts** (Slack/Email)
   - Critical errors
   - Performance degradation
   - Security events

4. **Custom Dashboards** (Grafana)
   - Business KPI visualization
   - Team-specific views
   - Custom metrics

5. **Data Warehouse** (BigQuery/Redshift)
   - Historical data analysis
   - Cross-application analytics
   - Business intelligence

---

**Document Version**: 1.0  
**Last Updated**: October 31, 2025  
**Status**: Planned/In Progress
