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

SQL-based migration files are version-controlled in Git alongside application code. Flyway validates and executes migrations in order on startup, making deployments reproducible across H2 (tests) and PostgreSQL (production). It prevents duplicate execution and fails fast if a migration is inconsistent.

---

## Alternatives Considered

**MySQL** — rejected. PostgreSQL has superior JSON support, more advanced query features (window functions, CTEs), and better horizontal scaling options.

**MongoDB** — rejected. Product inventory data is highly structured and relational. ACID compliance is non-negotiable for stock level accuracy.

**PostgreSQL for both production and tests** — rejected. Requires running a database service during development and in CI, slows test execution, and adds cost for test runs.

**Liquibase instead of Flyway** — rejected. Flyway is simpler: SQL-based migrations, smaller learning curve, no YAML/JSON overhead.

---

## Consequences

**Positive**: fast test suite (< 1 minute for 65+ tests), production-grade consistency, developers can work without external dependencies, schema changes are version-controlled and reproducible.

**Negative**: H2 does not support all PostgreSQL features, so migrations must use database-agnostic SQL. Any PostgreSQL-specific syntax in application queries must be tested carefully against H2 compatibility.

---

## Implementation Status

- PostgreSQL 17.5 on Neon — production
- H2 2.3.232 — test suite
- Flyway 11.7.2 — all environments
- HikariCP connection pooling — configured

---

[Back to Decisions Index](./index.md)
