# Staging & Configuration Management

**Purpose**: Document environment profiles, required environment variables, configuration hierarchy, and Koyeb variable setup.

---

## Environment Strategy

```
Development (Local) → Production (Koyeb)
```

No staging environment is currently active. A staging Koyeb service with a PostgreSQL test instance is planned for future use.

---

## Application Profiles

### Default — `application.properties`

Inherited by all environments:

```properties
server.port=8081
spring.application.name=stockease
spring.jpa.show-sql=false
spring.jpa.hibernate.ddl-auto=validate
spring.flyway.enabled=true
spring.flyway.locations=classpath:db/migration
management.endpoints.web.exposure.include=health,metrics
logging.level.root=INFO
logging.level.com.stocks.stockease=DEBUG
```

### Development — local overrides in `application.properties`

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/stockease_dev
spring.datasource.username=postgres
spring.datasource.password=postgres
spring.datasource.driver-class-name=org.postgresql.Driver
spring.jpa.show-sql=true
logging.level.com.stocks.stockease=DEBUG
logging.level.org.springframework.web=DEBUG
jwt.secret=dev-secret-key-do-not-use-in-production
jwt.expiration=86400000
app.cors.allowed-origins=http://localhost:3000,http://localhost:5173
```

### Production — `application-prod.yml`

```yaml
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
        dialect: org.hibernate.dialect.PostgreSQLDialect

logging:
  level:
    root: WARN
    com.stocks.stockease: INFO
    org.springframework: WARN

jwt:
  secret: ${JWT_SECRET}
  expiration: 86400000

app:
  cors:
    allowed-origins: https://stockease-frontend.onrender.com
```

### Test — `application-test.properties`

```properties
spring.datasource.url=jdbc:h2:mem:stockease_test
spring.datasource.driver-class-name=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=
spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
spring.jpa.hibernate.ddl-auto=create-drop
spring.jpa.show-sql=false
logging.level.root=WARN
jwt.secret=test-secret-key
jwt.expiration=86400000
```

---

## Required Environment Variables (Production)

| Variable | Purpose | Example |
|----------|---------|---------|
| `DB_HOST` | Neon database host | `[project].neon.tech` |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `stockease` |
| `DB_USER` | Database username | from secrets |
| `DB_PASSWORD` | Database password | from secrets |
| `JWT_SECRET` | JWT signing key (32+ chars) | from secrets |
| `SPRING_PROFILES_ACTIVE` | Active profile | `prod` |
| `JAVA_OPTS` | JVM tuning flags | `-Xmx512m -Xms256m` |

### Koyeb Variable Setup

In Koyeb dashboard → Service → Variables:

| Key | Scope |
|-----|-------|
| `DB_HOST` | Runtime |
| `DB_PORT` | Runtime |
| `DB_NAME` | Runtime |
| `DB_USER` | Runtime (secret) |
| `DB_PASSWORD` | Runtime (secret) |
| `JWT_SECRET` | Runtime (secret) |
| `SPRING_PROFILES_ACTIVE` | Runtime |
| `JAVA_OPTS` | Runtime |

---

## Configuration Hierarchy

Priority from highest to lowest:

1. Command-line arguments — `java -Dspring.datasource.url=...`
2. Environment variables — `export SPRING_DATASOURCE_URL=...`
3. Profile-specific file — `application-prod.yml`
4. Default file — `application.properties`
5. Spring Boot built-in defaults

---

## Configuration Rules

**Secrets are always environment variables** — never committed to the repository.

```yaml
# Correct
env:
  KOYEB_API_KEY: ${{ secrets.KOYEB_API_KEY }}

# Never do this
env:
  KOYEB_API_KEY: abc123...
```

**JWT secret must be 32+ characters** and randomly generated. The dev placeholder must never be used in production.

**CORS** must list only the production frontend domain in production — no wildcard.

**Logging** must be `WARN` or `INFO` in production. `DEBUG` leaks internals and degrades performance.

---

## Pre-Deployment Configuration Checklist

- [ ] All required environment variables set in Koyeb
- [ ] Database connection string includes `?sslmode=require`
- [ ] JWT secret is 32+ characters and random
- [ ] CORS origin matches production frontend domain exactly
- [ ] Logging level is WARN in production profile
- [ ] No debug endpoints exposed
- [ ] No default credentials (admin/admin123) in production seed data
- [ ] HikariCP pool settings validated (`maximumPoolSize=10`)
- [ ] Health check endpoint responding at `/health`

---

[Back to Deployment Index](./index.md)
