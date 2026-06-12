# Infrastructure

**Purpose**: Document the production deployment topology, Koyeb service configuration, database management, monitoring, and disaster recovery.

---

## Deployment Topology

```mermaid
graph TB
    subgraph GitHub["GitHub Repository"]
        MainBranch["main branch — Source Code"]
        DocsBranch["gh-pages branch — Published Docs"]
    end

    MainBranch -->|Push triggers| Actions

    subgraph Actions["GitHub Actions"]
        Build["deploy-backend.yml — Build, test, deploy to Koyeb"]
        Docs["docs-pipeline.yml — Generate and publish documentation"]
    end

    Build -->|Triggers redeploy| Koyeb
    Docs -->|Deploys HTML| Pages

    Koyeb["Koyeb — Container Service (Production)"]
    Pages["GitHub Pages — https://keglev.github.io/stockease/"]

    Koyeb -->|JDBC SSL| Neon["Neon PostgreSQL 17.5 — Serverless Database"]

    style GitHub fill:#f9f9f9
    style Actions fill:#e3f2fd
    style Koyeb fill:#fff3e0
    style Pages fill:#e8f5e9
    style Neon fill:#fce4ec
```

---

## Deployment Environments

| Environment | Branch | Database | URL |
|-------------|--------|----------|-----|
| Development | Any feature branch | H2 in-memory | localhost:8081 |
| Production | main | Neon PostgreSQL | stockease-backend-production.koyeb.app |

Staging (separate Koyeb service + PostgreSQL test instance) is available but not currently active.

---

## Koyeb Service Configuration

```yaml
Service Name: stockease-backend-production
Runtime: Docker (built from Dockerfile in repo)
Region: US (Auto)
Replicas: 1–2 (auto-scaling)

Environment Variables:
  SPRING_PROFILES_ACTIVE: production
  DB_HOST: [Neon endpoint]
  DB_PORT: 5432
  DB_NAME: stockease
  DB_USER: [from secrets]
  DB_PASSWORD: [from secrets]
  JWT_SECRET: [from secrets]
  JAVA_OPTS: -Xmx512m -Xms256m

Port Mapping:
  Container Port: 8081
  Public Port: 443 (HTTPS)
  Protocol: HTTP2

Health Check:
  Endpoint: /health
  Interval: 30s
  Timeout: 5s
  Consecutive Failures before unhealthy: 3
  Consecutive Successes before healthy: 1
```

### Auto-Scaling

```yaml
Min Replicas: 1
Max Replicas: 2
Target CPU: 70%
Target Memory: 80%
Scale Up Delay: 60s
Scale Down Delay: 300s
```

---

## Neon PostgreSQL (Production Database)

```
Host: [neon-project].neon.tech
Port: 5432
SSL Mode: require
Connection Pooling: enabled (limit: 100)
```

### Automated Backups
- Frequency: daily (automatic)
- Retention: 7 days
- Recovery: point-in-time restore available

### Database Migrations (Flyway)

```mermaid
erDiagram
    users {
        UUID id PK
        VARCHAR username UK
        VARCHAR password
        VARCHAR role
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    products {
        UUID id PK
        VARCHAR name
        DECIMAL price
        INTEGER quantity
        VARCHAR sku UK
        TIMESTAMP created_at
        TIMESTAMP updated_at
        UUID created_by FK
    }
    users ||--o{ products : "creates"
```

Migration files in `src/main/resources/db/migration/`:

| File | Action |
|------|--------|
| `V1__init_schema.sql` | Creates `users` and `products` tables |
| `V2__add_indexes.sql` | Adds indexes on `sku`, `category`, `username`, `created_by` |
| `V3__seed_data.sql` | Inserts admin/user accounts and sample products (H2-compatible) |

Flyway runs automatically on application startup and validates the schema version before allowing data access.

---

## Monitoring

### Health Endpoint

`GET /health` — public, used by Koyeb health checks.

```json
{
  "status": "UP",
  "components": {
    "db": { "status": "UP", "details": { "database": "PostgreSQL" } },
    "diskSpace": { "status": "UP" }
  }
}
```

### Application Logs

Captured by Koyeb via stdout/stderr. Key startup sequence:

```
INFO  Flyway Community Edition — Database: PostgreSQL 17.5
INFO  Successfully validated 3 migrations — Current version: 3
INFO  Will secure any request
INFO  Tomcat started on port(s): 8081
INFO  Started StockEaseApplication in 4.1s
```

### Tracked Metrics

Request count, response time (avg, P95, P99), error rate (4xx, 5xx), database connections (active/idle), memory (heap/non-heap), container CPU.

---

## Disaster Recovery

### If Deployment Fails
Koyeb automatically keeps the previous healthy version running. The pipeline marks the run as failed. Review logs on Koyeb and re-trigger once the issue is resolved.

### If Database Is Corrupted
1. Identify recovery point from Neon backups
2. Restore to a staging instance first
3. Verify application functionality against restored DB
4. Switch production connection to restored instance

### If Koyeb Service Goes Down
Manually trigger `deploy-backend.yml` via `workflow_dispatch`. Verify health checks pass before considering the issue resolved.

---

## Deployment Checklist

Before every production deployment:

- [ ] All tests passing (65+ tests)
- [ ] Code reviewed and approved
- [ ] Secrets configured in GitHub and Koyeb
- [ ] Database migrations validated against staging
- [ ] Health check endpoint responding
- [ ] CORS configured for production domain only
- [ ] SSL certificate active
- [ ] Backups verified
- [ ] Rollback plan confirmed (previous version available on Koyeb)

---

[Back to Deployment Index](./index.md)
