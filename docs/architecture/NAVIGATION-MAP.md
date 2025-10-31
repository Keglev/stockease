# Documentation Navigation Map

This map shows how all documentation files are interconnected through cross-references.

## Complete Navigation Graph

```
                          ┌─────────────────┐
                          │   index.md      │
                          │   (Hub/Nav)     │
                          └────────┬────────┘
                                   │
                ┌──────────────────┼──────────────────┐
                │                  │                  │
                ▼                  ▼                  ▼
        ┌─────────────────┐ ┌────────────────┐ ┌────────────────┐
        │  overview.md    │ │  backend.md    │ │ frontend.md    │
        │  (PRIMARY)      │ │  (Spring Boot) │ │  (React/TS)    │
        └────────┬────────┘ └────────┬───────┘ └────────┬───────┘
                 │                   │                   │
                 └───────┬───────────┼───────────┬───────┘
                         │           │           │
                         ▼           ▼           ▼
        ┌────────────────────┐  ┌────────────────────┐
        │   layers.md        │  │  security.md       │
        │   (Architecture)   │  │  (JWT & Auth)      │
        └────────┬───────────┘  └────────┬───────────┘
                 │                       │
                 └───────────┬───────────┘
                             │
                             ▼
        ┌────────────────────────────────────┐
        │   deployment.md                    │
        │   (Koyeb, Neon, CI/CD)             │
        └────────┬─────────────────────────────┘
                 │
        ┌────────┴────────────────────────────────────────┐
        │                                                 │
        ▼                                                 ▼
    ┌─────────────────────────────────┐    ┌─────────────────────────────┐
    │    decisions/                   │    │    patterns/                │
    ├─────────────────────────────────┤    ├─────────────────────────────┤
    │ 001-database-choice.md          │    │ repository-pattern.md       │
    │ 002-validation-strategy.md      │    │ security-patterns.md        │
    └─────────────────────────────────┘    └─────────────────────────────┘
        ▲                                       ▲
        │                                       │
        └───────────────────┬───────────────────┘
                            │
                            ▼
        ┌─────────────────────────────────────────┐
        │    deployment/                          │
        ├─────────────────────────────────────────┤
        │ ci-pipeline.md                          │
        │ staging-config.md                       │
        └─────────────────────────────────────────┘
```

## Link Flow by Topic

### Authentication & Security Topic
```
overview.md (Why JWT chosen?)
    ↓
security.md (JWT implementation)
    ↓ links to ↓
patterns/security-patterns.md (JWT, BCrypt, CORS details)
    ↓ links to ↓
backend.md (JwtTokenProvider code)
    ↓ links to ↓
layers.md (Security filters in controller)
    ↓ links to ↓
deployment.md (TLS/HTTPS in production)
    ↓ links to ↓
decisions/002-validation-strategy.md (Input validation defense)
```

### Database Topic
```
overview.md (Why PostgreSQL?)
    ↓
layers.md (Repository layer)
    ↓ links to ↓
backend.md (Spring Data JPA code)
    ↓ links to ↓
patterns/repository-pattern.md (Repository implementation)
    ↓ links to ↓
decisions/001-database-choice.md (PostgreSQL vs H2 justification)
    ↓ links to ↓
deployment.md (Neon PostgreSQL setup)
    ↓ links to ↓
deployment/ci-pipeline.md (Flyway migrations in CI/CD)
```

### Frontend-Backend Integration Topic
```
overview.md (Full-stack context)
    ↓
frontend.md (React APIs)
    ↓ links to ↓
backend.md (REST endpoints)
    ↓ links to ↓
layers.md (API layer in controllers)
    ↓ links to ↓
security.md (JWT token handling in API)
    ↓ links to ↓
deployment.md (Both deployed on Render/Koyeb)
    ↓ links to ↓
deployment/ci-pipeline.md (Frontend & backend CI/CD)
```

### Deployment Topic
```
overview.md (Architecture decisions)
    ↓
deployment.md (Infrastructure & CI/CD)
    ↓ links to ↓
deployment/ci-pipeline.md (GitHub Actions automation)
    ↓ links to ↓
deployment/staging-config.md (Pre-production testing)
    ↓ also references ↓
backend.md (Container image & tests)
frontend.md (Render deployment)
security.md (Security checklist)
patterns/security-patterns.md (Secure config)
```

## Navigation Paths by Role

### 👔 Project Manager / Stakeholder
```
START: overview.md (Business context)
  → Technology Stack section
  → Deployment Architecture section
  → Quality Attributes section
  ↓
THEN: deployment.md (Current status)
  → Production Environment diagram
  ↓
OPTIONAL: patterns/ (Best practices overview)
```

### 👨‍💻 Backend Developer (New)
```
START: index.md (Get oriented)
  ↓
THEN: overview.md (Full context)
  ↓
THEN: backend.md (Code organization)
  → Project Structure section
  → Controller/Service/Repository layers
  ↓
THEN: layers.md (Architecture patterns)
  → Request lifecycle
  → Layer interactions
  ↓
THEN: decisions/001-database-choice.md (Why PostgreSQL?)
  ↓
THEN: patterns/repository-pattern.md (Implementation details)
  ↓
THEN: security.md (Authentication to integrate)
  ↓
FINALLY: deployment.md (How to deploy changes)
```

### 🎨 Frontend Developer
```
START: index.md (Overview)
  ↓
THEN: overview.md (Backend context)
  → API Endpoints Overview table
  ↓
THEN: frontend.md (React implementation)
  → Component Hierarchy
  → API Integration section
  ↓
THEN: backend.md (What APIs to call)
  → ProductController section
  → AuthController section
  ↓
THEN: security.md (JWT token handling)
  → Authentication Flow section
  ↓
THEN: deployment.md (Render deployment)
  → Frontend Deployment section
```

### 🔧 DevOps / Infrastructure Engineer
```
START: deployment.md (Infrastructure overview)
  → Current Deployment Stack diagram
  → Production Environment description
  ↓
THEN: deployment/ci-pipeline.md (GitHub Actions setup)
  → Build steps
  → Deployment stages
  ↓
THEN: deployment/staging-config.md (Staging environment)
  → Testing configuration
  ↓
THEN: overview.md (Technology stack reference)
  → Technology Stack table
  ↓
THEN: security.md (Production security)
  → Deployment Security Checklist
  ↓
OPTIONAL: patterns/security-patterns.md (Secure configuration)
```

### 🧪 QA / Testing Engineer
```
START: overview.md (System overview)
  → Quality Attributes section
  ↓
THEN: backend.md (Testing strategies)
  → Testing section
  ↓
THEN: layers.md (What to test per layer)
  ↓
THEN: deployment/staging-config.md (Pre-prod testing)
  ↓
THEN: security.md (Security test cases)
  → JWT validation testing
  → Authorization testing
```

## Cross-Reference Statistics

### Link Density
| Document | Outgoing Links | Incoming Links | Hub Score |
|----------|---|---|---|
| overview.md | 11 | 6 | ⭐⭐⭐ High |
| backend.md | 11 | 5 | ⭐⭐ Medium |
| security.md | 10 | 6 | ⭐⭐⭐ High |
| deployment.md | 10 | 5 | ⭐⭐ Medium |
| layers.md | 8 | 5 | ⭐⭐ Medium |
| frontend.md | 8 | 4 | ⭐⭐ Medium |
| index.md | 8+ | 1 | ⭐⭐⭐ Hub |

### Coverage by Link Type
- **Horizontal (main ↔ main)**: ✅ Complete
- **Vertical (main → decisions)**: ✅ Complete
- **Vertical (main → patterns)**: ✅ Complete
- **Vertical (main → deployment)**: ✅ Complete
- **Feedback (sub → main)**: ⏳ Partial (ready to add)

## HTML Generation Benefits

When these markdown files are converted to HTML:

1. **Automatic Navigation**: MkDocs will create breadcrumb navigation
   ```
   Home / Architecture / Backend Architecture
   ```

2. **Clickable Cross-References**: All `[link](./file.md)` become clickable
   ```
   See [Repository Pattern](./patterns/repository-pattern.md) for details
   ↓ becomes clickable hyperlink in HTML
   ```

3. **Table of Contents**: Auto-generated from headers
   - Readers can jump to sections within documents
   - Cross-document navigation in sidebar

4. **Search Integration**: Search will index all documents
   - Find docs by topic keywords
   - Navigate to related docs

5. **Responsive Navigation**:
   - Desktop: Sidebar navigation with all cross-links
   - Mobile: Collapsible menu with breadcrumbs

## MkDocs Configuration Example

For HTML generation, configure mkdocs.yml:

```yaml
site_name: StockEase Documentation
docs_dir: backend/docs/architecture
site_dir: backend/docs/site

nav:
  - Home: index.md
  - Overview: overview.md
  - Architecture:
    - Backend: backend.md
    - Frontend: frontend.md
    - Layers: layers.md
    - Security: security.md
    - Deployment: deployment.md
  - Decisions:
    - Database Choice: decisions/001-database-choice.md
    - Validation Strategy: decisions/002-validation-strategy.md
  - Patterns:
    - Repository Pattern: patterns/repository-pattern.md
    - Security Patterns: patterns/security-patterns.md
  - Infrastructure:
    - CI/CD Pipeline: deployment/ci-pipeline.md
    - Staging Config: deployment/staging-config.md

theme:
  name: material
  palette:
    primary: blue
    accent: indigo
```

All cross-references will automatically become navigation links! 🎯

---

**Navigation Map Version**: 1.0  
**Status**: ✅ Complete - All cross-links verified  
**Last Updated**: October 31, 2025  
**Ready for**: MkDocs, ReDoc, HTML generation
