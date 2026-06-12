# Architecture Decision Records

Architectural decisions made during the design and implementation of StockEase, documented in ADR format.

---

## Decision Records

- [ADR 001 — Database Choice](./001-database-choice.md) — PostgreSQL for production, H2 for tests, Flyway for migrations
- [ADR 002 — Validation Strategy](./002-validation-strategy.md) — Multi-layer validation with JSR-303 annotations, service-level business rules, and database constraints
- [ADR 003 — Authentication Mechanism](./003-authentication-mechanism.md) — JWT stateless tokens over session-based authentication

---

## ADR Status Key

| Status | Meaning |
|--------|---------|
| Accepted | Decision is in effect |
| Deprecated | Superseded by a newer decision |
| Proposed | Under review, not yet implemented |

---

## Related Documentation

- [System Overview](../system/overview.md) — Design decisions in context
- [Security Architecture](../system/security.md) — JWT and BCrypt implementation
- [Patterns](../patterns/index.md) — Implementation patterns
- [Components](../components/index.md)

---

**Last Updated**: June 2026
**Status**: Current

[Back to Architecture Index](../index.md)
