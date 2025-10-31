# StockEase Architecture Documentation

Welcome to the StockEase Architecture Documentation Hub. This directory contains comprehensive documentation about the system architecture, design decisions, and implementation details.

## Quick Navigation

### 📋 Overview & Design
- **[overview.md](./overview.md)** - **START HERE** ⭐
  - Executive summary of the backend architecture
  - Business context and problem statement
  - C4 architecture model (Context, Container, Component levels)
  - Technology stack with versions
  - Key design decisions and rationale
  - Data models and entity relationships
  - API endpoints overview
  - Quality attributes and metrics
  - **Primary source of truth for architecture decisions**

### 🏗️ Architecture Layers
- **[layers.md](./layers.md)**
  - Service layer architecture (Controllers, Services, Repositories)
  - Data flow and request lifecycle
  - Component interaction patterns
  - Dependency injection configuration
  - Testing strategies per layer

### 🔐 Security Architecture
- **[security.md](./security.md)**
  - Authentication flow (JWT tokens)
  - Authorization and role-based access control (RBAC)
  - Spring Security configuration
  - Password hashing and encryption
  - CORS configuration and origin restrictions
  - Best practices and threat mitigation

### 🚀 Deployment Architecture
- **[deployment.md](./deployment.md)**
  - Infrastructure setup (Koyeb, Neon PostgreSQL)
  - CI/CD pipeline and GitHub Actions
  - Database migrations (Flyway)
  - Environment configuration
  - Monitoring and observability strategies
  - Disaster recovery and high availability

### 💻 Frontend Architecture
- **[frontend.md](./frontend.md)**
  - React 18 with TypeScript
  - Component hierarchy and structure
  - State management (React Query, Context API, Local Storage)
  - API integration and Axios configuration
  - i18n multi-language support
  - Dark mode and theme management
  - Responsive design with Tailwind CSS
  - Deployment to Render

### 📊 Complete System Overview
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** (Deprecated - refer to topic-specific docs above)
  - Comprehensive but superseded by topic-specific documentation
  - Kept for reference only

---

## Document Organization

This documentation is organized by **concerns** rather than by technology layer:

```
backend/docs/architecture/
├── index.md                 (Navigation hub - you are here)
├── overview.md              (Executive summary & design decisions) ⭐ PRIMARY
├── layers.md                (Backend service layers)
├── security.md              (Authentication & authorization)
├── deployment.md            (Infrastructure & CI/CD)
└── frontend.md              (React/TypeScript frontend)
```

## Reading Path for Different Roles

### 👔 Project Managers / Stakeholders
1. Start with [overview.md](./overview.md) - Business context section
2. Review Quality Attributes table
3. Check Future Enhancements for roadmap

### 👨‍💻 Backend Developers (New to Project)
1. Read [overview.md](./overview.md) - Full document for understanding
2. Study [layers.md](./layers.md) - Understand service architecture
3. Review [security.md](./security.md) - Authentication flows
4. Check [deployment.md](./deployment.md) - How to deploy locally

### 🎨 Frontend Developers
1. Read [overview.md](./overview.md) - Business context
2. Study [frontend.md](./frontend.md) - Component architecture
3. Review [security.md](./security.md) - JWT token handling
4. Check [deployment.md](./deployment.md) - Environment setup

### 🔧 DevOps / Infrastructure Engineers
1. Review [overview.md](./overview.md) - Technology Stack section
2. Study [deployment.md](./deployment.md) - Complete infrastructure guide
3. Check [layers.md](./layers.md) - Application topology
4. Review [security.md](./security.md) - Security requirements

### 🧪 QA / Testing Engineers
1. Read [overview.md](./overview.md) - Quality Attributes
2. Study [layers.md](./layers.md) - Testing strategies per layer
3. Review [security.md](./security.md) - Security test scenarios
4. Check test coverage in CI/CD logs

---

## Key Architecture Principles

### 1. **Layered Architecture**
Clean separation between Controllers, Services, and Repositories for maintainability and testability.

### 2. **Stateless Design**
JWT-based authentication enables horizontal scaling without session management complexity.

### 3. **Database Migrations with Flyway**
Versioned database schema changes ensure reproducible and safe deployments.

### 4. **Spring Data JPA**
ORM abstraction reduces boilerplate and enables database agnostic code.

### 5. **Containerized Deployment**
Docker containers ensure consistency across development, testing, and production environments.

### 6. **Test-Driven Development**
65+ unit and integration tests provide confidence in code changes and enable safe refactoring.

---

## Technology Stack at a Glance

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend Framework** | Spring Boot 3.5.7 | REST API & Core Framework |
| **ORM** | Spring Data JPA | Database abstraction |
| **Security** | Spring Security + JWT | Authentication & Authorization |
| **Database** | PostgreSQL 17.5 | Production data store |
| **Frontend** | React 18 + TypeScript | Web UI |
| **Build** | Maven 3.9.x | Dependency & Build Management |
| **Testing** | JUnit 5 + Mockito | Unit testing |
| **Deployment** | Docker + Koyeb | Containerized hosting |
| **CI/CD** | GitHub Actions | Automated pipelines |

---

## Key Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/auth/login` | POST | None | Authenticate and get JWT token |
| `/api/health` | GET | None | Health check (DB connectivity) |
| `/api/products` | GET | JWT | List all products |
| `/api/products/paged` | GET | JWT | Paginated product list |
| `/api/products/{id}` | GET | JWT | Get single product |
| `/api/products` | POST | JWT (Admin) | Create product |
| `/api/products/{id}` | PUT | JWT (Admin) | Update product |
| `/api/products/{id}` | DELETE | JWT (Admin) | Delete product |
| `/v3/api-docs` | GET | None | OpenAPI specification |

**Full API documentation**: See [overview.md - API Endpoints Overview](./overview.md#api-endpoints-overview)

---

## Quality Metrics

| Metric | Target | Status |
|--------|--------|--------|
| **Test Coverage** | >80% | ✅ 65+ tests |
| **Availability** | 99.9% | ✅ Auto-scaling |
| **Response Time** | <200ms | ✅ 50-150ms avg |
| **Scalability** | Horizontal | ✅ Stateless |
| **Security** | Enterprise | ✅ JWT + BCrypt |
| **Docs** | Auto-generated | ✅ OpenAPI + ReDoc |

---

## Getting Started

### Local Development Setup

**Backend:**
```bash
cd backend
mvn clean install              # Build & run tests
mvn spring-boot:run            # Start on :8081
```

**Frontend:**
```bash
cd frontend
npm install                    # Install dependencies
npm run dev                    # Start on :5173
```

**Database:**
- Option 1: Use local PostgreSQL
- Option 2: Use Neon dev branch (see [deployment.md](./deployment.md))

### View Documentation Locally

All documentation is written in Markdown and can be viewed:
1. Directly in VS Code (Markdown preview)
2. On GitHub (automatic rendering)
3. Via generated HTML on GitHub Pages: https://Keglev.github.io/stockease/

---

## Documentation Maintenance

- **Last Updated**: October 31, 2025
- **Maintained By**: Development Team
- **Review Cycle**: Quarterly or when major changes occur
- **Source of Truth**: [overview.md](./overview.md)

### Contributing to Docs
When making architectural changes:
1. Update the relevant doc file (layers, security, deployment, etc.)
2. Update the overview.md summary
3. Create a PR with docs changes
4. Request review from team leads

---

## Related Documentation

- **Project README**: [../../README.md](../../README.md)
- **Backend README**: [../../README.md](../../README.md)
- **Frontend README**: [../../../frontend/README.md](../../../frontend/README.md)
- **API Documentation**: See `/v3/api-docs` endpoint or visit https://Keglev.github.io/stockease/

---

## Questions or Suggestions?

If you have questions about the architecture:
1. Check the relevant documentation section above
2. Search for existing GitHub issues
3. Open a new issue with the `documentation` label
4. Reach out to the development team

---

**This is the navigation hub for StockEase Architecture Documentation. Start with [overview.md](./overview.md) if you're new to the project.**
