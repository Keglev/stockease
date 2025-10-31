# StockEase Backend Architecture Overview

## Executive Summary

StockEase is an enterprise-grade inventory management system built with **Spring Boot 3.5.7** and **PostgreSQL**. The backend provides RESTful APIs for product management, authentication, and inventory tracking with comprehensive test coverage (65+ tests) and containerized deployment on Koyeb.

**Live API**: https://stockease-backend-production.koyeb.app

## Business Context

### Problem Statement
Businesses need a centralized, secure, and scalable platform to:
- Manage product inventory in real-time
- Control user access with role-based authentication
- Track stock levels, pricing, and product metadata
- Provide reliable APIs for frontend and third-party integrations

### Solution Architecture
StockEase delivers:
- **Multi-user support** with role-based access control (Admin, User)
- **RESTful API** for CRUD operations on products and inventory
- **Secure authentication** using JWT tokens and BCrypt password hashing
- **Cloud-native deployment** with containerization and auto-scaling
- **Production-ready** database (PostgreSQL) with automated migrations

## C4 Architecture Model

### Context Diagram (Level 1)
```
┌─────────────────────────────────────────────────────┐
│                   StockEase System                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Frontend (Vue.js/TypeScript)                      │
│         ↓ HTTPS                                    │
│  Spring Boot Backend API                           │
│         ↓ JDBC/Flyway                              │
│  PostgreSQL Database (Neon)                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Container Diagram (Level 2)
```
┌──────────────────────────────────────────────────────────┐
│              StockEase Backend Container                 │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  API Endpoints                                          │
│  ├── AuthController (POST /api/auth/login, register)   │
│  ├── ProductController (GET /api/products)             │
│  ├── HealthController (GET /health)                    │
│  └── OpenAPI Endpoint (GET /v3/api-docs)              │
│                                                          │
│  Business Logic                                         │
│  ├── AuthService (JWT generation, user validation)     │
│  ├── ProductService (CRUD, filtering, pagination)      │
│  └── HealthService (system status checks)              │
│                                                          │
│  Data Access                                            │
│  ├── AuthRepository (Spring Data JPA)                  │
│  ├── ProductRepository (Spring Data JPA)               │
│  └── Flyway Migrations (Database schema)               │
│                                                          │
└──────────────────────────────────────────────────────────┘
         ↓ JDBC
    PostgreSQL Database
```

### Component Diagram (Level 3)

#### 1. Controllers Layer
- **AuthController**: Authentication endpoints (login, register, validate token)
- **ProductController**: Product management endpoints (create, read, update, delete, search, paginate)
- **HealthController**: System health check
- **OpenAPI Annotations**: Auto-generates API documentation

#### 2. Service Layer
- **AuthService**: 
  - User credential validation
  - JWT token generation and validation
  - Password hashing (BCrypt)
  - Role-based access control

- **ProductService**:
  - Business logic for product CRUD operations
  - Filtering and search functionality
  - Pagination and sorting
  - Data validation

- **HealthService**:
  - Database connectivity checks
  - Application status reporting

#### 3. Repository Layer (Spring Data JPA)
- **AuthRepository**: User persistence
- **ProductRepository**: Product persistence
- **Custom queries** for complex filtering

#### 4. Security Layer
- **JWT Provider**: Token generation and validation
- **BCrypt**: Password hashing
- **Spring Security**: HTTP Basic and Bearer token authentication
- **CORS Configuration**: Frontend integration

#### 5. Data Access Layer
- **Flyway**: Database versioning and migrations
- **PostgreSQL 17.5**: Production database (Neon)
- **H2**: In-memory test database

## Deployment Architecture

### Production Environment
```
┌──────────────────────────────────┐
│   GitHub Repository              │
│   (main + docs branches)         │
└────────────┬─────────────────────┘
             │
             ↓ Push to main
┌──────────────────────────────────┐
│   GitHub Actions CI/CD           │
│   ├── Build & Test               │
│   ├── Push to GHCR               │
│   ├── Deploy to Koyeb            │
│   └── Generate Docs → docs branch│
└────────────┬─────────────────────┘
             │
             ↓ Container Image
┌──────────────────────────────────┐
│   Koyeb Container Service        │
│   (Auto-scaling)                 │
└────────────┬─────────────────────┘
             │
             ↓ JDBC Connection
┌──────────────────────────────────┐
│   Neon PostgreSQL 17.5           │
│   (Serverless Database)          │
└──────────────────────────────────┘

Docs Branch → GitHub Pages
https://Keglev.github.io/stockease/
```

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Java | 17 LTS | JVM runtime |
| **Framework** | Spring Boot | 3.5.7 | REST API framework |
| **Security** | Spring Security | 6.3.1 | Authentication & authorization |
| **Data Access** | Spring Data JPA | 3.3.7 | ORM and database abstraction |
| **Migrations** | Flyway | 11.7.2 | Database versioning |
| **Database** | PostgreSQL | 17.5 | Production data store |
| **Testing** | JUnit 5 | 5.10.2 | Unit testing framework |
| **Testing DB** | H2 | 2.3.232 | In-memory test database |
| **Build** | Maven | 3.9.x | Build automation |
| **Documentation** | SpringDoc OpenAPI | 2.4.0 | OpenAPI/Swagger generation |
| **Container** | Docker | Latest | Containerization |
| **Deployment** | Koyeb | - | Cloud platform |

## Key Design Decisions

### 1. JWT-Based Authentication
**Decision**: Use JWT tokens instead of session-based authentication
- ✅ Stateless design enables horizontal scaling
- ✅ Works well with containerized microservices
- ✅ Supports frontend SPA applications
- ✅ Better mobile app integration

### 2. PostgreSQL Over H2 (Production)
**Decision**: Use Postgres for production, H2 for tests
- ✅ ACID compliance and reliability
- ✅ Proven enterprise database
- ✅ Better performance for production workloads
- ✅ H2 for fast test execution locally

### 3. Flyway for Database Migrations
**Decision**: Use Flyway instead of Hibernate auto-ddl
- ✅ Version control for database schema
- ✅ Reproducible deployments
- ✅ Safe migrations with validation
- ✅ Works with both H2 (tests) and Postgres (production)

### 4. Spring Data JPA for Persistence
**Decision**: Use Spring Data JPA instead of raw SQL
- ✅ Reduces boilerplate code
- ✅ Database agnostic (H2/Postgres)
- ✅ Automatic query generation
- ✅ Built-in pagination and sorting

### 5. Containerized Deployment (Koyeb)
**Decision**: Use container-based deployment
- ✅ Consistent environment from dev to production
- ✅ Easy auto-scaling
- ✅ Seamless CI/CD integration
- ✅ Infrastructure as code approach

## Data Models

### User/Authentication Entity
```
User
├── id: UUID (Primary Key)
├── username: String (Unique)
├── email: String (Unique)
├── password: String (BCrypt hashed)
├── role: Enum (ADMIN, USER)
├── createdAt: Timestamp
└── updatedAt: Timestamp
```

### Product Entity
```
Product
├── id: UUID (Primary Key)
├── name: String
├── description: Text
├── price: BigDecimal
├── quantity: Integer
├── sku: String (Unique)
├── category: String
├── createdAt: Timestamp
├── updatedAt: Timestamp
└── createdBy: UUID (Foreign Key to User)
```

## API Endpoints Overview

| Method | Endpoint | Authentication | Purpose |
|--------|----------|-----------------|---------|
| POST | `/api/auth/register` | None | Register new user |
| POST | `/api/auth/login` | Basic Auth | Login and get JWT |
| GET | `/api/auth/validate` | JWT Token | Validate token |
| GET | `/api/products` | JWT Token | List all products (paginated) |
| GET | `/api/products/{id}` | JWT Token | Get single product |
| POST | `/api/products` | JWT Token (ADMIN) | Create product |
| PUT | `/api/products/{id}` | JWT Token (ADMIN) | Update product |
| DELETE | `/api/products/{id}` | JWT Token (ADMIN) | Delete product |
| GET | `/health` | None | Health check |
| GET | `/v3/api-docs` | None | OpenAPI specification |

## Quality Attributes

| Attribute | Target | Status |
|-----------|--------|--------|
| **Test Coverage** | >80% | ✅ 65+ tests passing |
| **Availability** | 99.9% | ✅ Auto-scaling on Koyeb |
| **Response Time** | <200ms | ✅ In-memory caching where needed |
| **Scalability** | Horizontal | ✅ Stateless design, containerized |
| **Security** | Enterprise | ✅ JWT + BCrypt + CORS |
| **Documentation** | Auto-generated | ✅ OpenAPI + Redoc |

## Monitoring & Observability

### Current Metrics
- Build time: ~2-3 minutes
- Test execution: <1 minute
- Container startup: <10 seconds
- Average response time: 50-150ms

### Logs & Debugging
- Application logs via stdout/stderr (Koyeb captures)
- Request/response logging in critical paths
- Error tracking via HTTP status codes
- Performance metrics via OpenAPI documentation

## Future Enhancements

1. **Distributed Tracing**: Implement OpenTelemetry
2. **Caching Layer**: Add Redis for frequently accessed data
3. **Message Queue**: Implement Kafka for async operations
4. **Advanced Search**: Add Elasticsearch for product search
5. **Multi-tenancy**: Support multiple organizations
6. **API Rate Limiting**: Implement rate limiting per user/API key

---

**Document Version**: 1.0  
**Last Updated**: October 31, 2025  
**Status**: Production  
**Branch**: main
