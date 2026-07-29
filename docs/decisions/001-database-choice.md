# ADR 001: Database Choice

**Status**: Accepted
**Date**: October 31, 2025

---

## Context

StockEase requires a persistent data store for product inventory and user management. Three decisions were needed: production database technology, testing database technology, and schema migration tooling.

Requirements: ACID compliance, support for complex queries, fast test execution, no external dependencies during local development, and reproducible deployments.

---

## Decision

- **Production**: PostgreSQL 17.5 managed on Neon (serverless)
- **Testing**: H2 in-memory
- **Migrations**: Flyway 11.7.2

---

## Rationale

### PostgreSQL for Production

ACID compliance guarantees data integrity for inventory operations where partial writes would corrupt stock levels. PostgreSQL provides full-text search, JSONB, window functions, and CTEs for future analytics needs. Neon delivers serverless PostgreSQL with automatic backups, connection pooling, and pay-as-you-go pricing suitable for the current scale.

### H2 for Testing

In-memory execution means no network latency or external service dependency — the full test suite completes in under one minute. Each test gets a fresh database, ensuring isolation and deterministic results. Developers need no local PostgreSQL installation.

### Flyway for Migrations

Migration files (SQL and Java) are version-controlled in Git alongside application code. Flyway validates and executes migrations in order on startup, making deployments reproducible across H2 (tests) and PostgreSQL (production). It prevents duplicate execution and fails fast if a migration is inconsistent. Java migrations (`BaseJavaMigration`) are used when SQL alone is insufficient — for example, `V3__seed_data.java` uses `BCryptPasswordEncoder` to hash passwords at migration time.

---

## Alternatives Considered

**MySQL** — rejected. PostgreSQL has superior JSON support, more advanced query features (window functions, CTEs), and better horizontal scaling options.

**MongoDB** — rejected. Product inventory data is highly structured and relational. ACID compliance is non-negotiable for stock level accuracy.

**PostgreSQL for both production and tests** — rejected. Requires running a database service during development and in CI, slows test execution, and adds cost for test runs.

**Liquibase instead of Flyway** — rejected. Flyway is simpler: SQL and Java migrations, smaller learning curve, no YAML/JSON overhead.

---

## Consequences

**Positive**: fast test suite (< 1 minute for 65+ tests), production-grade consistency, developers can work without external dependencies, schema changes are version-controlled and reproducible.

**Negative**: H2 does not support all PostgreSQL features, so SQL migrations must use database-agnostic syntax. Any PostgreSQL-specific syntax in application queries must be tested carefully against H2 compatibility. Java migrations bypass this constraint by using JDBC directly, but they require Spring dependencies (e.g. `BCryptPasswordEncoder`) to be on the classpath at migration time.

---

## Implementation Status

- PostgreSQL 17.5 on Neon — production
- H2 2.3.232 — test suite
- Flyway 11.7.2 — all environments
- HikariCP connection pooling — configured

---

## 2025 Infrastructure Change

The project migrated from Render (both hosting and managed PostgreSQL) to **Koyeb** (container hosting) and **Neon PostgreSQL** (managed serverless database). The primary driver was cost reduction: Render's free tier was deprecated, whereas Koyeb and Neon both offer free tiers with pay-as-you-go pricing that scales with actual usage.

Additional technical benefits:

- **Neon** provides serverless PostgreSQL with autoscaling compute, automatic daily backups, point-in-time restore, and built-in connection pooling — without a dedicated always-on server. The datasource configuration changed from a `DB_HOST`/`DB_PORT`/`DB_NAME` triplet to a single `SPRING_DATASOURCE_URL` environment variable containing the full JDBC connection string (SSL enforced).
- **Koyeb** supports Docker-based deployment with native HTTP/2, health-probe integration, auto-scaling replicas, and a built-in HTTPS edge — equivalent production infrastructure at lower cost.

### Why Flyway with a Java Migration Instead of Pure SQL

`V3__seed_data.java` extends `BaseJavaMigration` rather than using a plain SQL file for one unavoidable reason: **passwords must be BCrypt-hashed at migration time**. A SQL migration can only insert static string literals — invoking `BCryptPasswordEncoder` requires running application code from the Spring Security classpath, which only a Java migration can do.

The Java migration also achieves cross-database idempotence without relying on PostgreSQL-specific syntax: rather than `INSERT ... ON CONFLICT DO NOTHING` (which H2 does not support), the migration queries for row existence first and skips the insert if the row is already present. This keeps the test environment (H2 in-memory, `create-drop`) fully compatible with the same migration code.

Alternatives considered and rejected:

| Alternative | Why Rejected |
|-------------|-------------|
| Pure SQL `INSERT` with plaintext passwords | Passwords would be stored unhashed — security violation |
| PostgreSQL `ON CONFLICT DO NOTHING` | Not supported by H2; breaks test environment compatibility |
| Application-level `DataSeeder.java` only | Only runs in non-production profiles; cannot seed production on first deploy |
| Liquibase custom task | Adds Liquibase as a second migration tool alongside Flyway — rejected when Flyway was chosen over Liquibase |

---

[Back to Decisions Index](./index.md)
