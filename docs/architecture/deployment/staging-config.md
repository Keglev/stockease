# Staging & Configuration Management

## Environment Strategy

StockEase uses environment-based configuration to manage different deployment targets:

```
Development (Local)
  ↓ (git push)
Production (Koyeb)
```

## Configuration Levels

### 1. Application Configuration (application.properties)

**Location**: `src/main/resources/application.properties`

**Default configuration** (inherited by all environments):

```properties
# Server
server.port=8080
server.servlet.context-path=/

# Spring Boot
spring.application.name=stockease
spring.profiles.active=default

# JPA/Hibernate
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.hibernate.ddl-auto=validate

# Flyway
spring.flyway.enabled=true
spring.flyway.locations=classpath:db/migration

# Actuator
management.endpoints.web.exposure.include=health,metrics

# Logging
logging.level.root=INFO
logging.level.com.stocks.stockease=DEBUG
```

### 2. Environment-Specific Overrides

#### Development Profile (application.properties)
**Used**: Local development

```properties
# Database
spring.datasource.url=jdbc:postgresql://localhost:5432/stockease_dev
spring.datasource.username=postgres
spring.datasource.password=postgres
spring.datasource.driver-class-name=org.postgresql.Driver

# JPA
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true

# Logging
logging.level.root=INFO
logging.level.com.stocks.stockease=DEBUG
logging.level.org.springframework.web=DEBUG

# Security
jwt.secret=dev-secret-key-do-not-use-in-production
jwt.expiration=86400000

# CORS
app.cors.allowed-origins=http://localhost:3000,http://localhost:5173
```

#### Production Profile (application-prod.yml)
**Used**: Koyeb deployment

```yaml
# Database (from environment variables)
spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require
    username: ${DB_USER}
    password: ${DB_PASSWORD}
    driver-class-name: org.postgresql.Driver
    hikari:
      maximum-pool-size: 10
      minimum-idle: 2
      
  jpa:
    show-sql: false
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        format_sql: false
        dialect: org.hibernate.dialect.PostgreSQLDialect

# Logging
logging:
  level:
    root: WARN
    com.stocks.stockease: INFO
    org.springframework: WARN
  file:
    name: /var/log/stockease/app.log

# Security
jwt:
  secret: ${JWT_SECRET}
  expiration: 86400000

# CORS
app:
  cors:
    allowed-origins: https://stockease.example.com
```

#### Test Profile (application-test.properties)
**Used**: Test suite

```properties
# Database (H2 in-memory)
spring.datasource.url=jdbc:h2:mem:stockease_test
spring.datasource.driver-class-name=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=

# H2 console
spring.h2.console.enabled=true

# JPA
spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
spring.jpa.hibernate.ddl-auto=create-drop
spring.jpa.show-sql=false

# Logging
logging.level.root=WARN
logging.level.com.stocks.stockease=INFO

# Security (test values)
jwt.secret=test-secret-key
jwt.expiration=86400000
```

## Environment Variables

### Required for Production

```bash
# Database
export DB_HOST=...neon.tech
export DB_PORT=5432
export DB_NAME=stockease
export DB_USER=<username>
export DB_PASSWORD=<password>

# Security
export JWT_SECRET=<32+ random characters>

# Spring
export SPRING_PROFILES_ACTIVE=prod
```

### Koyeb Environment Setup

In Koyeb dashboard → Service → Variables:

```
Key                     | Value                      | Scope
------------------------|----------------------------|----------
DB_HOST                 | [neon-endpoint]            | Runtime
DB_PORT                 | 5432                       | Runtime
DB_NAME                 | stockease                  | Runtime
DB_USER                 | [from secrets]             | Runtime
DB_PASSWORD             | [from secrets]             | Runtime
JWT_SECRET              | [from secrets]             | Runtime
SPRING_PROFILES_ACTIVE  | prod                       | Runtime
```

## Deployment Topology

### Development Environment
```
Developer Laptop
├── Spring Boot Application
│   ├── Port 8080
│   └── Auto-restart on code change (DevTools)
└── PostgreSQL (local or Docker)
    ├── Database: stockease_dev
    └── Migrations auto-run (Flyway)
```

### Production Environment (Koyeb)
```
GitHub Repository (main branch)
  ↓ git push
GitHub Actions (deploy-backend.yml)
  ├── Tests
  ├── Build Docker image
  └── Push to GHCR
  
Koyeb Service (Docker container)
  ├── Port 8080 (internal)
  ├── Exposed via HTTPS
  └── Environment variables injected
  
Neon PostgreSQL (serverless)
  ├── SSL connection required
  ├── Connection pooling
  └── Auto-backups
```

## Configuration Management Best Practices

### 1. Environment Variable Naming
```properties
# Use clear, prefixed names
DB_HOST          # Not: "database_server" or "db"
JWT_SECRET       # Not: "secret" or "key"
MAX_POOL_SIZE    # Not: "max"
```

### 2. Sensitive Data Handling
```bash
# ✅ USE: Environment variables for secrets
export DB_PASSWORD=$(kubectl get secret db-creds -o jsonpath='{.data.password}')

# ✅ USE: GitHub Secrets for CI/CD
KOYEB_API_KEY: ${{ secrets.KOYEB_API_KEY }}

# ❌ DON'T: Hardcode secrets
DB_PASSWORD=my-password  # NEVER!
```

### 3. Configuration Validation
```java
@Configuration
@ConfigurationProperties(prefix = "app")
@Validated
public class AppConfig {
    @NotBlank(message = "JWT secret is required")
    @Min(32)
    private String jwtSecret;
    
    @NotEmpty
    private List<String> allowedOrigins;
}
```

### 4. Logging Configuration
```yaml
# Development (verbose)
logging:
  level:
    root: INFO
    com.stocks.stockease: DEBUG
    org.springframework.security: DEBUG

# Production (minimal)
logging:
  level:
    root: WARN
    com.stocks.stockease: INFO
    org.springframework.security: WARN
```

## Migration Strategy

### Schema Migrations (Flyway)

**Development**:
```bash
# Automatic: mvnw spring-boot:run
# Flyway auto-runs V1, V2, V3 migrations
```

**Production** (Koyeb):
```bash
# Automatic: On container startup
# Flyway applies any new migrations
# Fails fast if migration has issues
```

### Data Migrations

```sql
-- V4__add_product_status.sql
ALTER TABLE products ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE';
UPDATE products SET status = 'ACTIVE';
ALTER TABLE products ALTER COLUMN status SET NOT NULL;
```

## Configuration Hierarchy

```
Priority (highest to lowest):

1. Command-line arguments
   java -Dspring.datasource.url=...

2. Environment variables
   export SPRING_DATASOURCE_URL=...

3. application-{profile}.yml/properties
   application-prod.yml

4. application.yml/properties
   application.properties (default)

5. Built-in defaults
   Spring Boot defaults
```

## Troubleshooting Configuration

### Missing Configuration Error
```
Error: Could not resolve placeholder 'db.host' in value "${db.host}"

Solution: Set environment variable DB_HOST=...
```

### Wrong Profile Active
```bash
# Check active profile
curl http://localhost:8080/actuator/env | grep spring.profiles.active

# Set profile explicitly
export SPRING_PROFILES_ACTIVE=prod
```

### Configuration Not Reloading
```bash
# Development: Automatic with DevTools
# Production: Restart container

# Local test change:
mvnw spring-boot:run -Dspring-boot.run.arguments="--spring.profiles.active=test"
```

## Configuration Validation Checklist

Before production deployment:
- [ ] All required environment variables set
- [ ] Database connection string correct (with SSL)
- [ ] JWT secret is 32+ characters and random
- [ ] CORS origins match frontend domain
- [ ] Logging level appropriate (WARN/ERROR)
- [ ] No debug endpoints exposed
- [ ] No default credentials remaining
- [ ] Connection pool settings optimized
- [ ] Health check endpoint working
- [ ] Metrics endpoint secured

## Performance Tuning

### Database Connection Pool
```properties
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=2
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.idle-timeout=600000
```

### Application Server
```properties
server.tomcat.threads.max=200
server.tomcat.threads.min-spare=10
server.compression.enabled=true
server.compression.min-response-size=1024
```

### JVM Arguments
```bash
java -Xmx512m -Xms256m -XX:+UseG1GC -Dfile.encoding=UTF-8 -jar app.jar
```

## Monitoring & Alerts

### Health Endpoint
```bash
curl -s http://localhost:8080/health | jq '.'
```

### Metrics
```bash
curl -s http://localhost:8080/metrics | jq '.names[]'
```

### Common Metrics to Monitor
- `jvm.memory.used` - Heap memory usage
- `process.cpu.usage` - CPU utilization
- `http.server.requests` - Request rate
- `db.connection.active` - DB connections
- `spring.security.authentication.failure` - Auth failures

---

**Document Version**: 1.0  
**Last Updated**: October 31, 2025  
**Status**: Production Ready
