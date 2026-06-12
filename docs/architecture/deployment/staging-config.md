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

Inherited by all environments (key properties shown):

```properties
spring.application.name=StockEase
spring.datasource.url=${NEON_JDBC_URL:${DATABASE_URL:}}
spring.datasource.username=${SPRING_DATASOURCE_USERNAME}
spring.datasource.password=${SPRING_DATASOURCE_PASSWORD}
spring.datasource.driver-class-name=org.postgresql.Driver
# WARNING: overridden to validate in application-prod.yml; must never reach production as update
spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.show-sql=true
spring.jpa.open-in-view=false
server.port=8081
logging.level.com.stocks.stockease=INFO
logging.level.org.springframework=INFO
logging.level.org.hibernate.SQL=WARN
logging.level.org.apache.catalina=WARN
```

### Development

Development uses the same `application.properties` file. Environment variables (`SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `NEON_JDBC_URL`) are supplied via IDE run configuration or a local `.env` file. There is no separate `application-dev.properties`.

### Production — `application-prod.yml`

```yaml
management:
  endpoints:
    web:
      exposure:
        include: "health,info"
  endpoint:
    health:
      probes:
        enabled: true
      show-details: "when_authorized"

spring:
  main:
    lazy-initialization: false
  jpa:
    hibernate:
      ddl-auto: validate
  datasource:
    url: ${SPRING_DATASOURCE_URL}
    username: ${SPRING_DATASOURCE_USERNAME}
    password: ${SPRING_DATASOURCE_PASSWORD}
    hikari:
      minimum-idle: 0
      maximum-pool-size: 5
      idle-timeout: 120000
      connection-timeout: 30000
      max-lifetime: 1800000
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
    clean-disabled: true

logging:
  level:
    '[org.flywaydb]': INFO
    '[com.stocks.stockease]': INFO
```

### Test — `application-test.properties`

```properties
spring.datasource.url=jdbc:h2:mem:testdb
spring.datasource.driver-class-name=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=

spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
spring.jpa.hibernate.ddl-auto=create-drop
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.open-in-view=false

spring.datasource.hikari.connection-test-query=SELECT 1
spring.datasource.hikari.maximum-pool-size=5
```

---

## Required Environment Variables (Production)

| Variable | Purpose | Example |
|----------|---------|---------|
| `SPRING_DATASOURCE_URL` | Neon JDBC connection string (includes host, port, DB name, SSL mode) | from Neon dashboard |
| `SPRING_DATASOURCE_USERNAME` | Database username | from secrets |
| `SPRING_DATASOURCE_PASSWORD` | Database password | from secrets |
| `JWT_SECRET` | JWT signing key (32+ chars) | from secrets |
| `SPRING_PROFILES_ACTIVE` | Active profile | `prod` |
| `JAVA_OPTS` | JVM tuning flags | `-Xmx512m -Xms256m` |

### Koyeb Variable Setup

In Koyeb dashboard → Service → Variables:

| Key | Scope |
|-----|-------|
| `SPRING_DATASOURCE_URL` | Runtime (secret) |
| `SPRING_DATASOURCE_USERNAME` | Runtime (secret) |
| `SPRING_DATASOURCE_PASSWORD` | Runtime (secret) |
| `JWT_SECRET` | Runtime (secret) |
| `SPRING_PROFILES_ACTIVE` | Runtime |
| `JAVA_OPTS` | Runtime |

---

## Seed Data — V3 Migration and DataSeeder

Fixture data is seeded by two mechanisms with different scopes:

### V3 Flyway Migration (all Flyway-enabled environments, including production)

`V3__seed_data.java` (located at `src/main/java/db/migration/`) runs as part of the Flyway migration sequence in every environment where Flyway is active. It seeds:

| Credential | Role | Purpose |
|-----------|------|---------|
| `admin` / `admin123` | `ROLE_ADMIN` | Full access for development and testing |
| `user` / `user123` | `ROLE_USER` | Read-only access for development and testing |

8 fixture products are also seeded: Alpha Widget, Beta Gadget, Gamma Tool, Delta Device, Epsilon Accessory, Zeta Instrument, Eta Apparatus, Theta Machine.

All inserts are idempotent — each row is inserted only if it does not already exist (checked by username or product name), so re-running migrations never creates duplicates.

### DataSeeder — Test Environment Fallback

`DataSeeder.java` (`@Profile("!prod")`) runs at application startup in non-production profiles. In all Flyway-enabled environments, V3 populates the database before `DataSeeder` runs, so `DataSeeder`'s `count() == 0` guards make it a no-op.

`DataSeeder` only takes effect in **test environments** where `spring.flyway.enabled=false` (H2 in-memory, DDL `create-drop`) and the database starts empty. It is **not active** in the `prod` profile.

---

## FlywayConfiguration — Migration Ordering

`FlywayConfiguration.java` overrides Spring Boot's auto-configured Flyway bean to resolve a startup ordering issue in **Spring Boot 3.5.x**: without explicit ordering, `EntityManagerFactory` may attempt to validate the schema before Flyway has had a chance to create it.

Key settings:

| Setting | Value | Reason |
|---------|-------|--------|
| `baselineOnMigrate` | `true` | Handles databases that already have a schema |
| `cleanDisabled` | `true` | Prevents accidental database wipe in production |
| `outOfOrder` | `true` | Allows applying migrations out of version order |
| `connectRetries` | `20` (every 2s) | Tolerates slow database availability at startup |

The `spring.flyway.enabled=false` property (used in test profiles) disables migration entirely — when disabled, `FlywayConfiguration` creates a no-op Flyway instance and skips migration.

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
- [ ] HikariCP pool settings validated (`maximumPoolSize=5`)
- [ ] Health check endpoint responding at `/health`

---

[Back to Deployment Index](./index.md)
