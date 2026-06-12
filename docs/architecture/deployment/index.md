# Deployment — Index

**Scope**: Infrastructure, CI/CD pipelines, containerization, and environment configuration for StockEase.

---

## Documents in This Directory

- [Infrastructure](./infrastructure.md) — Deployment topology, Koyeb service configuration, Neon PostgreSQL, auto-scaling, monitoring, disaster recovery, and deployment checklist
- [CI/CD Pipeline](./ci-pipeline.md) — GitHub Actions workflows: deploy-backend.yml and docs-pipeline.yml stage details, secret management, failure handling, and rollback strategy
- [Docker Strategy](./docker-strategy.md) — Multi-stage Dockerfile, layer caching, security hardening, image registry, and build/run commands
- [Staging & Configuration](./staging-config.md) — Environment profiles (dev, prod, test), environment variables, configuration hierarchy, and Koyeb variable setup

---

## Quick Reference

| Topic | File |
|-------|------|
| Where is the app hosted? | [infrastructure.md](./infrastructure.md) |
| How does CI/CD work? | [ci-pipeline.md](./ci-pipeline.md) |
| How is Docker configured? | [docker-strategy.md](./docker-strategy.md) |
| How are environments configured? | [staging-config.md](./staging-config.md) |
| What are the required secrets? | [ci-pipeline.md](./ci-pipeline.md) |
| What env vars are needed in production? | [staging-config.md](./staging-config.md) |

---

## Related Documentation

- [System Overview](../system/overview.md) — Architecture context
- [Backend Architecture](../system/backend.md) — Application being deployed
- [Security Architecture](../system/security.md) — Security requirements for production

---

**Last Updated**: June 2026
**Status**: Current

[Back to Architecture Index](../index.md)
