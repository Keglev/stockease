# Components Architecture

## Overview

The StockEase backend is composed of several key components that interact to provide product inventory management functionality. This section describes each major component and its responsibilities.

## Component Interactions

```
┌─────────────────────────────────────────────────────────┐
│                   REST Clients                          │
│         (Frontend, Mobile, Third-party APIs)            │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/HTTPS
┌────────────────────────▼────────────────────────────────┐
│              Spring Security Layer                      │
│         (CORS, JWT, Authentication)                    │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              API Controllers                            │
│  ├── AuthController (login, register, validate)       │
│  ├── ProductController (CRUD, search, pagination)     │
│  └── HealthController (system status)                 │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              Service Layer                             │
│  ├── AuthService (authentication logic)               │
│  ├── ProductService (business logic)                  │
│  └── HealthService (health checks)                    │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              Repository Layer (JPA)                     │
│  ├── UserRepository (User persistence)                │
│  ├── ProductRepository (Product persistence)          │
│  └── Custom queries and specifications                │
└────────────────────────┬────────────────────────────────┘
                         │ JDBC
┌────────────────────────▼────────────────────────────────┐
│              Database Layer                            │
│  ├── PostgreSQL (production)                          │
│  ├── H2 (testing)                                     │
│  └── Flyway (migrations)                              │
└─────────────────────────────────────────────────────────┘
```

## AuthController

**Location**: `src/main/java/com/stocks/stockease/controller/AuthController.java`

**Responsibility**: Handle authentication endpoints

**Endpoints**:
```
POST /api/auth/register
  Input: { username, email, password }
  Output: { userId, username, role }
  Status: 201 Created / 400 Bad Request

POST /api/auth/login
  Input: username + password (HTTP Basic)
  Output: { token, userId, username, role }
  Status: 200 OK / 401 Unauthorized

GET /api/auth/validate
  Input: JWT token in header
  Output: { valid, userId, username, role }
  Status: 200 OK / 401 Unauthorized
```

**Integration**:
```
AuthController
  ↓ calls
AuthService
  ↓ uses
UserRepository
  ↓ persists
User Entity (users table)
```

**Dependencies**:
- `AuthService` - business logic
- `UserRepository` - data access
- `PasswordEncoder` - password hashing
- `JwtUtil` - token generation

**Error Handling**:
- Username already exists → 400 Bad Request
- Invalid credentials → 401 Unauthorized
- Expired token → 401 Unauthorized
- Internal server error → 500 Internal Server Error

## ProductController

**Location**: `src/main/java/com/stocks/stockease/controller/ProductController.java`

**Responsibility**: Handle product management endpoints

**Endpoints**:
```
GET /api/products
  Query: ?page=0&size=20&sort=name,asc&category=electronics
  Output: { content: [], page, size, totalElements, totalPages }
  Auth: JWT required

GET /api/products/{id}
  Output: { id, name, description, price, quantity, sku, category, createdAt }
  Auth: JWT required

POST /api/products
  Input: { name, description, price, quantity, sku, category }
  Output: { id, name, ... }
  Auth: JWT + ADMIN role required

PUT /api/products/{id}
  Input: { name, description, price, quantity, category }
  Output: { id, name, ... (updated) }
  Auth: JWT + ADMIN role required

DELETE /api/products/{id}
  Output: { message: "Product deleted successfully" }
  Auth: JWT + ADMIN role required
```

**Integration**:
```
ProductController
  ↓ calls
ProductService
  ↓ uses
ProductRepository
  ↓ persists
Product Entity (products table)
```

**Dependencies**:
- `ProductService` - business logic
- `ProductRepository` - data access
- `SecurityContext` - user authentication

**Error Handling**:
- Product not found → 404 Not Found
- Insufficient permissions → 403 Forbidden
- Validation errors → 400 Bad Request
- SKU already exists → 400 Bad Request

## HealthController

**Location**: `src/main/java/com/stocks/stockease/controller/HealthController.java`

**Responsibility**: Provide system health status

**Endpoints**:
```
GET /health
  Output: { status, components: { db, diskSpace, ... } }
  Auth: None required

GET /health/liveness
  Output: { status }
  Auth: None required

GET /health/readiness
  Output: { status, components: { db, ... } }
  Auth: None required
```

**Used By**:
- Koyeb health checks
- Monitoring systems
- Load balancers

## AuthService

**Location**: `src/main/java/com/stocks/stockease/service/AuthService.java`

**Responsibility**: Authentication business logic

**Methods**:

```java
public UserDTO register(RegisterRequest request)
  - Validate input (username, email, password)
  - Check username uniqueness
  - Hash password with BCrypt
  - Create User entity
  - Save to database
  - Return UserDTO

public LoginResponse authenticate(String username, String password)
  - Find user by username
  - Verify password
  - Generate JWT token
  - Return token + user info

public UserDTO validateToken(String token)
  - Parse JWT token
  - Verify signature
  - Check expiration
  - Return user info

public void logout(String userId)
  - Invalidate token (future: add to blacklist)
```

**Validation Rules**:
- Username: 3-50 chars, alphanumeric + underscore
- Email: valid email format
- Password: 8+ chars, mixed case + numbers
- Role: ADMIN or USER

**Transactions**:
- `register()` - @Transactional
- `authenticate()` - read-only
- `validateToken()` - read-only

## ProductService

**Location**: `src/main/java/com/stocks/stockease/service/ProductService.java`

**Responsibility**: Product business logic

**Methods**:

```java
public Page<ProductDTO> getProducts(
    int page, int size, String sort, String category)
  - Build dynamic query with filters
  - Apply pagination
  - Execute query
  - Map to DTOs
  - Return PageResponse

public ProductDTO getProductById(UUID id)
  - Find product by ID
  - Return ProductDTO
  - Throw EntityNotFoundException if not found

public ProductDTO createProduct(
    CreateProductRequest request, UUID userId)
  - Validate request
  - Check authorization (ADMIN only)
  - Verify SKU uniqueness
  - Create Product entity
  - Set metadata (createdAt, createdBy)
  - Save to database
  - Return ProductDTO

public ProductDTO updateProduct(
    UUID id, UpdateProductRequest request, UUID userId)
  - Find product by ID
  - Validate request
  - Check authorization (ADMIN only)
  - Update fields
  - Save changes
  - Return updated ProductDTO

public void deleteProduct(UUID id, UUID userId)
  - Find product by ID
  - Check authorization (ADMIN only)
  - Delete from database
```

**Validation Rules**:
- Name: 3-255 chars, not blank
- Price: > 0, max 999,999.99
- Quantity: >= 0, max 1,000,000
- SKU: 3-50 chars, alphanumeric + hyphens, unique
- Category: alphanumeric + spaces

**Transactions**:
- `createProduct()` - @Transactional
- `updateProduct()` - @Transactional
- `deleteProduct()` - @Transactional
- `getProducts()` - read-only
- `getProductById()` - read-only

## HealthService

**Location**: `src/main/java/com/stocks/stockease/service/HealthService.java`

**Responsibility**: System health checks

**Methods**:

```java
public HealthStatus getHealth()
  - Check database connectivity
  - Check disk space
  - Check memory usage
  - Return aggregated status

public boolean isDatabaseHealthy()
  - Execute test query: SELECT 1
  - Return true if successful
  - Return false if connection fails
```

**Health Components**:
- `db` - Database connectivity
- `diskSpace` - Available disk space
- `livenessState` - Application running
- `readinessState` - Ready to accept requests

## Repository Interfaces

### UserRepository

```java
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
}
```

### ProductRepository

```java
public interface ProductRepository extends JpaRepository<Product, UUID> {
    Optional<Product> findBySku(String sku);
    Page<Product> findByCategory(String category, Pageable pageable);
    List<Product> findByCreatedBy(UUID userId);
    
    @Query("SELECT p FROM Product p WHERE p.price > ?1 AND p.quantity > 0")
    List<Product> findAffordableInStock(BigDecimal maxPrice);
}
```

## Exception Handling

**Custom Exceptions**:
- `ValidationException` → 400 Bad Request
- `AuthenticationException` → 401 Unauthorized
- `AuthorizationException` → 403 Forbidden
- `EntityNotFoundException` → 404 Not Found
- `InternalServerException` → 500 Internal Server Error

**Global Exception Handler**:
- `@RestControllerAdvice` catches exceptions
- Formats error responses
- Sets appropriate HTTP status codes
- Logs errors for debugging

## Component Dependencies Graph

```
HealthController
  └── HealthService
      └── Database connection

AuthController
  └── AuthService
      ├── UserRepository
      ├── PasswordEncoder
      └── JwtUtil

ProductController
  ├── ProductService
  │   ├── ProductRepository
  │   ├── UserRepository (authorization)
  │   └── Validators
  └── SecurityContext

SecurityConfig
  ├── JwtFilter
  ├── PasswordEncoder (BCrypt)
  └── CustomUserDetailsService
```

---

**Document Version**: 1.0  
**Last Updated**: October 31, 2025  
**Status**: Production Ready
