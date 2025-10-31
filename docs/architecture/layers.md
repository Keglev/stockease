# Service Layers & Component Architecture

## Layered Architecture

StockEase follows a **classic N-tier layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────┐
│          REST Controllers (Endpoints)       │  ← HTTP Layer
├─────────────────────────────────────────────┤
│    Security Layer (JWT, Spring Security)    │  ← Cross-cutting Concern
├─────────────────────────────────────────────┤
│        Business Logic (Services)            │  ← Domain Layer
├─────────────────────────────────────────────┤
│   Data Access (Repositories, Entities)      │  ← Persistence Layer
├─────────────────────────────────────────────┤
│    Database (PostgreSQL / H2 for tests)     │  ← Data Layer
└─────────────────────────────────────────────┘
```

## Layer Descriptions

### 1. HTTP/Presentation Layer (Controllers)

**Purpose**: Handle HTTP requests/responses, input validation, and routing

**Components**:
- `AuthController` - Authentication endpoints
- `ProductController` - Product CRUD endpoints
- `HealthController` - System health check
- `ExceptionHandler` - Global error handling

**DTOs used by controllers**:
- `LoginRequest` — { username: String, password: String } (validated with @NotBlank)
- `ApiResponse<T>` — Generic response envelope: { success: boolean, message: String, data: T }
- `PaginatedResponse<T>` — Wrapper for Spring Page with pagination metadata (pageNumber, pageSize, totalElements, totalPages)

**Responsibilities**:
```
Request → Validate Input → Call Service → Format Response → HTTP Status
```

**Example Flow**:
```java
// POST /api/products
@PostMapping
public ResponseEntity<ProductDTO> createProduct(
    @RequestBody CreateProductRequest req,
    @RequestHeader("Authorization") String token) {
    
    // 1. Controller validates request format
    // 2. Controller calls ProductService
    // 3. Service validates business logic
    // 4. Controller formats response
    // 5. Returns HTTP 201 Created
}
```

### 2. Security Layer (Cross-cutting)

**Purpose**: Enforce authentication and authorization across all endpoints

**Components**:
- `JwtProvider` - Generate and validate JWT tokens
- `SecurityConfig` - Spring Security configuration
- `AuthenticationFilter` - Intercept and validate requests
- `PasswordEncoder` - BCrypt hashing

**Authentication Flow**:
```
1. User calls POST /api/auth/login with username:password
   ↓
2. Spring Security intercepts (HTTP Basic)
   ↓
3. UserDetailsService validates credentials
   ↓
4. JwtProvider generates token
   ↓
5. Token returned in response
   ↓
6. Client includes token in Authorization: Bearer {token} header
   ↓
7. On subsequent requests, JwtProvider validates token
   ↓
8. If valid → Request proceeds to Service Layer
   If invalid → 401 Unauthorized returned
```

**Protected Endpoints**:
- All `/api/products/*` endpoints require JWT token
- `/health` is public (no auth required)

**Controller / Endpoint summary**

| Controller | Key Endpoints | Auth Requirement |
|------------|---------------|------------------|
| `AuthController` | POST `/api/auth/login` | Public (permitAll)
| `HealthController` | GET `/api/health` | Public
| `ProductController` | GET `/api/products` | JWT (`ADMIN`,`USER`)
| `ProductController` | GET `/api/products/paged` | JWT (`ADMIN`,`USER`)
| `ProductController` | GET `/api/products/{id}` | JWT (`ADMIN`,`USER`)
| `ProductController` | POST `/api/products` | JWT (`ADMIN`)
| `ProductController` | PUT `/api/products/{id}/quantity` | JWT (`ADMIN`,`USER`)
| `ProductController` | PUT `/api/products/{id}/price` | JWT (`ADMIN`,`USER`)
| `ProductController` | PUT `/api/products/{id}/name` | JWT (`ADMIN`,`USER`)
| `ProductController` | GET `/api/products/low-stock` | JWT (`ADMIN`,`USER`)
| `ProductController` | GET `/api/products/search` | JWT (`ADMIN`,`USER`)
| `ProductController` | DELETE `/api/products/{id}` | JWT (`ADMIN`)
| `ProductController` | GET `/api/products/total-stock-value` | JWT (`ADMIN`,`USER`)

### 3. Business Logic Layer (Services)

**Purpose**: Implement business rules, validation, and orchestration

**Components**:
- `AuthService` - User authentication and authorization
- `ProductService` - Product business logic
- `HealthService` - System status
- Custom validators and processors

**AuthService Responsibilities**:
```
registerUser(username, password)
  ├── Validate username (not empty, unique)
  ├── Validate password (strength requirements)
  ├── Hash password with BCrypt
  ├── Create User entity
  ├── Save to database
  └── Return UserDTO

authenticateUser(username, password)
  ├── Find user by username
  ├── Compare provided password with hashed password
  ├── Generate JWT token (with role)
  ├── Return token + user info
  └── Throw exception if auth fails

validateToken(token)
  ├── Parse JWT signature
  ├── Check expiration
  ├── Extract user claims
  └── Return user info or throw exception
```

**ProductService Responsibilities**:
```
createProduct(request, userId, role)
  ├── Validate request (name, price, quantity)
  ├── Check authorization (ADMIN only)
  ├── Check SKU uniqueness
  ├── Create Product entity
  ├── Set metadata (createdAt, createdBy)
  ├── Save to database
  └── Return ProductDTO

getProducts(page, size, sort, filter)
  ├── Build dynamic query from filters
  ├── Apply pagination (page, size)
  ├── Apply sorting (name, price, date)
  ├── Execute query
  ├── Map to DTOs
  └── Return PageResponse

updateProduct(id, request, userId, role)
  ├── Find product by ID
  ├── Check authorization (ADMIN only)
  ├── Validate request fields
  ├── Update product fields
  ├── Set updatedAt timestamp
  ├── Save to database
  └── Return updated ProductDTO

deleteProduct(id, userId, role)
  ├── Find product by ID
  ├── Check authorization (ADMIN only)
  ├── Delete from database
  └── Return success
```

**Key Design Patterns**:
- **Dependency Injection**: Spring injects repositories into services
- **Validation**: Validate before database calls
- **Error Handling**: Throw domain-specific exceptions
- **Transaction Management**: `@Transactional` for data consistency

### 4. Data Access Layer (Repositories & Entities)

**Purpose**: Abstract database operations and provide query interface

**Components**:
- `User` entity - JPA entity mapping to users table
- `Product` entity - JPA entity mapping to products table
- `AuthRepository` - Spring Data JPA repository for User
- `ProductRepository` - Spring Data JPA repository for Product

**Entity Example**:
```java
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @Column(unique = true, nullable = false)
    private String username;
    
    @Column(nullable = false)
    private String password; // BCrypt hashed
    
    @Enumerated(EnumType.STRING)
    private Role role; // ADMIN, USER
    
    @CreationTimestamp
    private LocalDateTime createdAt;
}
```

**Repository Interface**:
```java
public interface ProductRepository extends JpaRepository<Product, UUID> {
    // Spring Data generates SQL automatically
    Optional<Product> findBySku(String sku);
    List<Product> findByCategory(String category);
    Page<Product> findAll(Pageable pageable);
    
    // Custom query if needed
    @Query("SELECT p FROM Product p WHERE p.price > ?1 AND p.quantity > 0")
    List<Product> findAffordableInStock(BigDecimal maxPrice);
}
```

**Database Operations**:
```
Java Service → Spring Data JPA → JDBC Driver → PostgreSQL/H2
```

### 5. Database Layer (Persistence)

**Purpose**: Store and retrieve data reliably

**Production Database**:
- **PostgreSQL 17.5** (Neon serverless)
- ACID compliance
- Full-text search capabilities
- Connection pooling (HikariCP)

**Test Database**:
- **H2** (in-memory)
- Fast test execution
- Data isolation per test
- No external dependencies

**Schema Management**:
```
Flyway Migrations → Database Versioning
V1__init_schema.sql     ← Create tables
V2__add_indexes.sql     ← Add performance optimizations
V3__seed_data.sql       ← Populate test data
```

## Data Flow Diagram

### Create Product Flow
```
1. Frontend (Vue.js)
   ├── User fills form (name, price, quantity)
   ├── Sends POST /api/products with JWT token
   └── Content-Type: application/json

2. HTTP Layer (ProductController)
   ├── Receives request
   ├── Validates JSON structure
   ├── Calls productService.createProduct(request, token)
   └── Catches exceptions

3. Security Layer
   ├── Validates JWT token
   ├── Extracts user ID and role
   ├── Checks if user has ADMIN role
   └── Returns 403 Forbidden if unauthorized

4. Business Logic Layer (ProductService)
   ├── Validates business rules:
   │   ├── Name is not empty
   │   ├── Price > 0
   │   ├── SKU is unique
   │   └── Quantity >= 0
   ├── Creates Product entity
   ├── Sets metadata (createdAt, createdBy)
   ├── Calls productRepository.save(product)
   └── Throws ValidationException if validation fails

5. Data Access Layer (Spring Data JPA)
   ├── Converts Product entity to SQL INSERT
   ├── Executes: INSERT INTO products (name, price, sku, ...) VALUES (...)
   └── Returns saved Product with generated ID

6. Database Layer (PostgreSQL)
   ├── Validates constraints (unique SKU, NOT NULL fields)
   ├── Executes INSERT
   ├── Triggers any cascade operations
   └── Returns INSERTING succeeds or error

7. Back through layers with response:
   ├── JPA returns Product entity
   ├── Service returns ProductDTO
   ├── Controller formats HTTP response
   ├── Returns HTTP 201 Created with Location header
   └── Frontend receives response and updates UI

Response JSON:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Widget",
  "price": 29.99,
  "sku": "WIDGET-001",
  "quantity": 100,
  "createdAt": "2025-10-31T10:30:00Z"
}
```

### Get Products with Filtering Flow
```
1. Frontend
   ├── Sends: GET /api/products?page=0&size=20&sort=name,asc&category=electronics

2. ProductController
   ├── Extracts query parameters
   ├── Calls productService.getProducts(page, size, sort, category)

3. ProductService
   ├── Builds dynamic WHERE clause: category = 'electronics'
   ├── Creates PageRequest(0, 20, Sort.by("name").ascending())
   ├── Calls productRepository.findAll(spec, pageRequest)

4. Spring Data JPA
   ├── Translates to SQL:
   │   SELECT * FROM products
   │   WHERE category = 'electronics'
   │   ORDER BY name ASC
   │   LIMIT 20 OFFSET 0
   │   
   ├── Executes query

5. Database
   ├── Scans products table (uses index on category)
   ├── Filters results
   ├── Orders by name
   ├── Returns limited result set

6. Back through layers:
   ├── JPA returns Page<Product>
   ├── Service converts to Page<ProductDTO>
   ├── Controller formats JSON response
   └── Returns HTTP 200 OK with pagination metadata

Response JSON:
{
  "content": [
    { "id": "...", "name": "...", "category": "electronics" },
    ...
  ],
  "page": 0,
  "size": 20,
  "totalElements": 150,
  "totalPages": 8,
  "last": false
}
```

## Component Dependencies

```
AuthController
  ├── depends on: AuthService
  ├── depends on: JwtProvider
  └── depends on: PasswordEncoder

ProductController
  ├── depends on: ProductService
  ├── depends on: SecurityContext (JWT validation)
  └── depends on: ExceptionHandler

AuthService
  ├── depends on: AuthRepository
  ├── depends on: PasswordEncoder
  ├── depends on: JwtProvider
  └── depends on: UserRepository

ProductService
  ├── depends on: ProductRepository
  ├── depends on: Custom validators
  └── depends on: Mappers (Entity → DTO)

AuthRepository
  └── accesses: User entity (users table)

ProductRepository
  └── accesses: Product entity (products table)

Security Configuration
  ├── depends on: JwtProvider
  ├── depends on: UserDetailsService
  └── depends on: PasswordEncoder
```

## Transaction Boundaries

**Read Operations** (No transaction needed):
- GET /api/products (read-only)
- GET /api/products/{id} (read-only)
- GET /health (read-only)

**Write Operations** (@Transactional required):
```java
@Transactional
public void createProduct(CreateProductRequest req) {
    // BEGIN TRANSACTION
    
    // Multiple operations treated as atomic
    Product product = new Product(req);
    productRepository.save(product); // Can fail
    auditLog.log("Product created", product.getId()); // Can fail
    
    // COMMIT TRANSACTION (if all succeed)
    // ROLLBACK TRANSACTION (if any operation fails)
}
```

## Error Handling Strategy

```
Layer → Exception → Handler → Response

Application Exception
  ├── ValidationException (400 Bad Request)
  ├── AuthenticationException (401 Unauthorized)
  ├── AuthorizationException (403 Forbidden)
  ├── EntityNotFoundException (404 Not Found)
  └── InternalServerException (500 Internal Server Error)

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ErrorResponse> handleValidation(ValidationException e) {
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse(e.getMessage(), "VALIDATION_ERROR"));
    }
}
```

## Performance Considerations

### Database Indexing
```sql
-- Indexed for fast lookups
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_users_username ON users(username);
```

### Query Optimization
- Use pagination for list endpoints (avoid loading 10k+ records)
- Use lazy loading for relationships
- Cache frequently accessed data
- Use database-level filtering before returning to application

### Connection Pooling
- HikariCP manages database connections
- Maximum pool size: 10 connections
- Reduces connection overhead

---

**Document Version**: 1.0  
**Last Updated**: October 31, 2025  
**Status**: Production
