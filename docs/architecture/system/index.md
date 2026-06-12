# System Architecture — Index

**Scope**: This index covers the /system directory. For testing documentation, see the [Testing Architecture](../testing/testing-architecture.md). For deployment, see the [deployment](../deployment/) directory.

---

## Documents in This Directory

### Overview
- [Architecture Overview](./overview.md) — Executive summary, C4 diagrams, tech stack, design decisions, API map, quality attributes
- [Architektur-Übersicht (Deutsch)](./overview.de.md) — Deutsche Version der Übersicht

### Application Architecture
- [Backend Architecture](./backend.md) — Layered architecture, project structure, controller/service/repository/entity/security code, DB migrations, configuration
- [Service Layers](./layers.md) — Layer responsibilities, data flow diagrams, transaction boundaries, component dependencies, error handling strategy
- [Security Architecture](./security.md) — HTTPS/TLS, JWT flow, RBAC matrix, BCrypt, CORS, input validation, SQL injection prevention, audit logging

### Integration
- [Frontend Integration](./frontend-integration.md) — React architecture, component hierarchy, state management, API integration, authentication flow, i18n, dark mode

---

## Reading Paths by Role

**New to the project** — Start with [Architecture Overview](./overview.md), then [Backend Architecture](./backend.md).

**Backend Developer** — [Backend Architecture](./backend.md) → [Service Layers](./layers.md) → [Security Architecture](./security.md).

**Security / DevOps** — [Security Architecture](./security.md) → [Backend Architecture](./backend.md) → deployment docs.

**Frontend Developer** — [Frontend Integration](./frontend-integration.md) → [Security Architecture](./security.md) for JWT and CORS details.

---

## Related Directories

- [Testing Architecture](../testing/testing-architecture.md) — Entry point for all test documentation
- [Deployment](../deployment/) — CI/CD pipeline, Docker, staging configuration
- [Decisions (ADRs)](../decisions/) — Architecture decision records
- [Patterns](../patterns/) — Repository pattern, security patterns
- [Components](../components/) — Analytics service, observability

---

**Last Updated**: June 2026
**Status**: Current

[Back to Architecture Index](../index.md)
