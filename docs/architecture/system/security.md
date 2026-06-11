# Security Architecture

## Overview

StockEase implements a **defense-in-depth security model** with multiple layers of protection:

```
┌─────────────────────────────────────────┐
│     HTTPS/TLS (Transport Security)      │
├─────────────────────────────────────────┤
│    CORS (Cross-Origin Resource Sharing) │
├─────────────────────────────────────────┤
│   HTTP Security Headers (Security)      │
├─────────────────────────────────────────┤
│    Authentication (JWT Tokens)          │
├─────────────────────────────────────────┤
│   Authorization (Role-Based Access)     │
├─────────────────────────────────────────┤
│     Input Validation & Sanitization     │
├─────────────────────────────────────────┤
│      Password Hashing (BCrypt)          │
├─────────────────────────────────────────┤
│  Database Security (Parameterized SQL)  │
└─────────────────────────────────────────┘
```

## 1. Transport Security (HTTPS/TLS)

### Implementation
- **Protocol**: HTTPS only (TLS 1.2+)
- **Certificate**: Managed by Koyeb/CloudFlare
- **Force HTTPS**: All HTTP requests redirected to HTTPS

### Configuration
```yaml
# application.properties
server.ssl.enabled=true
server.ssl.key-store-type=PKCS12
# Certificates managed by infrastructure
```

### Benefits
- Encrypts all data in transit
- Prevents man-in-the-middle attacks
- Protects credentials and tokens
- Required for production APIs

## 2. Authentication & Authorization

### JWT (JSON Web Tokens)

**Purpose**: Stateless, scalable authentication

**Token Structure**:
```
Header.Payload.Signature

Header:
{
  "alg": "HS256",
  "typ": "JWT"
}

Payload:
{
  "sub": "user-id-uuid",
  "username": "john.doe",
  "role": "ADMIN",
  "iat": 1701418200,
  "exp": 1701504600,
  "iss": "stockease-backend",
  "aud": "stockease-frontend"
}

Signature:
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  secret_key
)
```

**Token Generation Flow**:
```
1. User calls POST /api/auth/login
   ├── Headers: Content-Type: application/json
   └── Body: { "username": "admin", "password": "admin123" }

2. AuthController receives request
   ├── Calls AuthService.authenticate(username, password)
   └── AuthService validates credentials

3. Credential Validation
   ├── Find user by username in database
   ├── Compare provided password with BCrypt hash
   ├── If match → proceed to token generation
   ├── If no match → throw AuthenticationException (401)
   └── If user not found → throw AuthenticationException (401)

4. JWT Token Generation
   ├── Create payload with:
   │   ├── User ID (sub claim)
   │   ├── Username
   │   ├── Role (ADMIN / USER)
   │   ├── Issue time (iat)
   │   ├── Expiration time (exp = iat + 24 hours)
   │   ├── Issuer (iss)
   │   └── Audience (aud)
   ├── Sign with secret key (HS256)
   └── Encode as base64url string

5. Response
   ├── Status: 200 OK
   ├── Body: { "token": "eyJhbG...", "expiresIn": 86400 }
   └── Client stores token (localStorage / sessionStorage)

### Login Sequence (simplified)

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant BE as Backend (Spring Boot)
  U->>FE: Submit credentials (username/password)
  FE->>BE: POST /api/auth/login (JSON body)
  BE->>BE: Authenticate (AuthenticationManager)
  BE->>BE: Lookup user (UserRepository)
  BE->>BE: Generate JWT (JwtUtil)
  BE-->>FE: 200 OK + { token }
  FE-->>U: Store token; use for subsequent requests
```
```

**Token Usage in Requests**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Every subsequent request must include this header
```

**Token Validation Flow**:
```
1. Request arrives at controller with JWT token

2. SecurityFilter intercepts request
   ├── Extracts token from Authorization header
   ├── Calls JwtProvider.validateToken(token)
   └── Passes token to validation logic

3. JWT Validation
   ├── Verify token format (Header.Payload.Signature)
   ├── Verify signature using secret key
   ├── Check expiration time (exp claim vs current time)
   ├── Extract claims (user ID, role)
   ├── If valid → create Authentication object
   ├── If invalid/expired → throw JwtException (401)
   └── If malformed → throw JwtException (401)

4. SecurityContext Set
   ├── Store Authentication in SecurityContext
   ├── Make available to controller via @AuthenticationPrincipal
   └── Controller can access user info

5. Request Proceeds
   ├── SecurityFilter passes to next filter
   ├── Request reaches ProductController
   └── Can access authenticated user info
```

### Role-Based Access Control (RBAC)

**Roles Defined**:
```java
public enum Role {
    ADMIN,   // Full access: create, read, update, delete
    USER     // Limited access: read only
}
```

**Authorization Rules (implemented)**:

| Endpoint | Method | ADMIN | USER | Anonymous |
|----------|--------|-------|------|-----------|
| `/api/health` | GET | ✅ | ✅ | ✅ |
| `/api/auth/login` | POST | ❌ | ❌ | ✅ (public) |
| `/api/products` | GET | ✅ | ✅ | ❌ |
| `/api/products/paged` | GET | ✅ | ✅ | ❌ |
| `/api/products/{id}` | GET | ✅ | ✅ | ❌ |
| `/api/products` | POST | ✅ | ❌ | ❌ |
| `/api/products/{id}/quantity` | PUT | ✅ | ✅ | ❌ |
| `/api/products/{id}/price` | PUT | ✅ | ✅ | ❌ |
| `/api/products/{id}/name` | PUT | ✅ | ✅ | ❌ |
| `/api/products/low-stock` | GET | ✅ | ✅ | ❌ |
| `/api/products/search` | GET | ✅ | ✅ | ❌ |
| `/api/products/total-stock-value` | GET | ✅ | ✅ | ❌ |
| `/api/products/{id}` | DELETE | ✅ | ❌ | ❌ |

> Notes: The table above reflects the current `SecurityConfig` in code: login is permitted publicly (`/api/auth/login`), health is public, product create/delete are admin-only, and most read/update product endpoints allow ADMIN and USER.

### API Map (quick reference)

| Endpoint | Purpose | Auth |
|---|---:|---|
| `POST /api/auth/login` | Return JWT for valid credentials | Public (no token)
| `GET /api/health` | Liveness/database connectivity | Public
| `GET /api/products` | List products | JWT (ADMIN/USER)
| `POST /api/products` | Create product | JWT (ADMIN)
| `PUT /api/products/{id}/quantity` | Update product quantity | JWT (ADMIN/USER)
| `DELETE /api/products/{id}` | Delete product | JWT (ADMIN)


**Authorization Implementation**:
```java
@PostMapping
@PreAuthorize("hasRole('ADMIN')")
public ResponseEntity<ProductDTO> createProduct(
    @RequestBody CreateProductRequest req) {
    // Only users with ADMIN role can reach here
    return productService.create(req);
}

// Or using method-level security:
@Service
public class ProductService {
    @Secured("ROLE_ADMIN")
    public void deleteProduct(UUID id) {
        // Only ADMIN can call this method
    }
}
```

## 3. Password Security

### BCrypt Hashing

**Purpose**: Store passwords securely, never in plaintext

**BCrypt Properties**:
- **One-way hash**: Cannot reverse to get original password
- **Salt included**: Each password has unique salt (prevents rainbow tables)
- **Adaptive**: Slower algorithm resists brute force
- **Configurable strength**: Cost factor 10-12 iterations

**Password Hashing Flow**:
```
1. User provides password: "MySecurePass123!"

2. BCryptPasswordEncoder
   ├── Generate random salt
   ├── Apply BCrypt algorithm with salt
   ├── Produce hash: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36CHhzPm
   └── Store hash in database

3. Password Verification (login)
   ├── User provides password: "MySecurePass123!"
   ├── Retrieve stored hash from database
   ├── Apply BCrypt with provided password and stored salt
   ├── Compare computed hash with stored hash
   ├── If match → password correct (401 vs 200)
   ├── If no match → authentication failed (401 Unauthorized)
   └── Never store or log plaintext password
```

**Configuration**:
```java
@Configuration
public class SecurityConfig {
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10); // strength 10
    }
}
```

## 4. API Security

### CORS (Cross-Origin Resource Sharing)

**Purpose**: Control which origins can access the API

**Configuration**:
```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins("https://stockease.example.com")
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .allowedHeaders("Content-Type", "Authorization")
            .exposedHeaders("X-Total-Count", "X-Page-Count")
            .allowCredentials(true)
            .maxAge(3600);
    }
}
```

**Production Settings**:
- ✅ Specific allowed origins (not `*`)
- ✅ Limited HTTP methods
- ✅ Credentials allowed for same-site requests
- ✅ Limited max-age (3600 seconds)

### Security Headers

**Headers Set by Spring Security**:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Cache-Control: no-cache, no-store, must-revalidate
```

**What They Prevent**:
- `HSTS`: Forces HTTPS-only communication
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing
- `X-Frame-Options: DENY`: Prevents clickjacking
- `X-XSS-Protection`: Enables browser XSS protection

## 5. Input Validation & Sanitization

### Request Validation

**Purpose**: Prevent malformed data and malicious inputs

**Validation Rules**:
```java
public class CreateProductRequest {
    @NotNull(message = "Name cannot be null")
    @NotBlank(message = "Name cannot be blank")
    @Size(min = 3, max = 255, message = "Name must be 3-255 characters")
    private String name;
    
    @NotNull(message = "Price cannot be null")
    @DecimalMin(value = "0.01", message = "Price must be > 0")
    @DecimalMax(value = "999999.99", message = "Price cannot exceed 999999.99")
    private BigDecimal price;
    
    @NotNull(message = "Quantity cannot be null")
    @Min(value = 0, message = "Quantity cannot be negative")
    @Max(value = 1000000, message = "Quantity cannot exceed 1,000,000")
    private Integer quantity;
    
    @NotBlank(message = "SKU is required")
    @Pattern(
        regexp = "^[A-Z0-9-]{3,50}$",
        message = "SKU must be 3-50 chars, alphanumeric and hyphens only"
    )
    private String sku;
}
```

**Validation Execution**:
```
1. Request arrives at @PostMapping
2. @Valid annotation triggers validation
3. CreateProductRequest deserialized and validated
4. Validation fails → MethodArgumentNotValidException thrown
5. GlobalExceptionHandler catches exception
6. Returns 400 Bad Request with error details

Response (if validation fails):
{
  "status": 400,
  "error": "Validation Failed",
  "message": "Validation failed for argument 'request'",
  "details": [
    {
      "field": "name",
      "message": "Name must be 3-255 characters"
    },
    {
      "field": "price",
      "message": "Price must be > 0"
    }
  ]
}
```

### SQL Injection Prevention

**Parameterized Queries** (Spring Data JPA):
```java
// ✅ SAFE: Spring Data prevents SQL injection
productRepository.findBySku(userProvidedSku);

// ✅ SAFE: Native query with parameters
@Query("SELECT p FROM Product p WHERE p.sku = ?1")
Optional<Product> findBySku(String sku);

// ❌ DANGEROUS: String concatenation
Query q = entityManager.createNativeQuery(
    "SELECT * FROM products WHERE sku = '" + userInput + "'"
);
// This allows SQL injection!
```

## 6. Database Security

### Connection Security
```yaml
# application.properties
spring.datasource.url=jdbc:postgresql://host:5432/stockease?sslmode=require
spring.datasource.username=${DB_USER}
spring.datasource.password=${DB_PASSWORD}
```

**Environment Variables** (never hardcoded):
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password
- `JWT_SECRET`: JWT signing key

### Row-Level Security (Future)
```sql
-- Example: Users can only see products they created
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_products ON products
  USING (created_by = current_user_id());
```

## 7. Audit Logging

**Logged Events**:
```
- User login attempt (success/failure)
- User registration
- Product creation (who, when)
- Product modification (who, when)
- Product deletion (who, when)
- Authorization failures (403 errors)
- API errors (500 errors)
```

**Log Format**:
```
[2025-10-31 10:30:45] INFO  [AuthService] User 'john.doe' logged in successfully
[2025-10-31 10:31:12] INFO  [ProductService] Product 'Widget' created by admin (ID: ...)
[2025-10-31 10:32:00] WARN  [SecurityFilter] Unauthorized access attempt: invalid token
[2025-10-31 10:33:15] ERROR [ProductService] Database error: connection timeout
```

## 8. Security Best Practices Implemented

| Practice | Implementation | Status |
|----------|-----------------|--------|
| HTTPS/TLS | Koyeb managed certificates | ✅ |
| JWT Tokens | HS256 signing with secret key | ✅ |
| Password Hashing | BCrypt with cost factor 10 | ✅ |
| RBAC | ADMIN/USER roles | ✅ |
| Input Validation | @Valid + JSR-303 annotations | ✅ |
| SQL Injection Prevention | Parameterized queries (JPA) | ✅ |
| CORS | Restricted to specific origins | ✅ |
| Security Headers | HSTS, X-Frame-Options, etc. | ✅ |
| Audit Logging | Request logging in critical paths | ✅ |
| Secrets Management | Environment variables, no hardcoding | ✅ |
| Rate Limiting | Per-endpoint rate limiting (future) | ⏳ |
| API Key Management | Support for API keys (future) | ⏳ |

## 9. Default Credentials (Development/Testing)

**Purpose**: Enable quick testing without additional setup

**Admin User**:
```
Username: admin
Password: admin123
Role: ADMIN
```

**Regular User**:
```
Username: user
Password: user123
Role: USER
```

⚠️ **WARNING**: These credentials are seeded via V3 migration for development only. In production, create secure passwords and remove seed data.

## 10. Security Testing

### Test Coverage
```
- Authentication tests (valid/invalid credentials)
- Authorization tests (ADMIN vs USER endpoints)
- Password hashing verification
- JWT token validation/expiration
- CORS policy enforcement
- Input validation edge cases
- SQL injection attempts (should fail)
```

### Example Security Test
```java
@Test
public void testUnauthorizedAccessToProductCreation() {
    // User role cannot create products
    mockMvc.perform(post("/api/products")
        .header("Authorization", "Bearer " + userToken)
        .contentType(MediaType.APPLICATION_JSON)
        .content(jsonRequest))
        .andExpect(status().isForbidden()); // 403
}

@Test
public void testInvalidTokenRejection() {
    mockMvc.perform(get("/api/products")
        .header("Authorization", "Bearer invalid-token"))
        .andExpect(status().isUnauthorized()); // 401
}
```

## 11. Deployment Security Checklist

Before production deployment:
- [ ] Change all default credentials
- [ ] Remove seed data (V3 migration)
- [ ] Set strong JWT secret (32+ characters)
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS for production domain only
- [ ] Set up audit logging
- [ ] Enable database backups
- [ ] Review security headers
- [ ] Perform security testing
- [ ] Set up monitoring/alerting
- [ ] Document security policies
- [ ] Conduct code review for security issues

---

## Related Documentation

### Main Architecture Topics
- **[Architecture Overview](./overview.md)** - Overall system context and security decisions
- **[Backend Architecture](./backend.md)** - Spring Security configuration in code
- **[Service Layers](./layers.md)** - Authorization checks in Controller and Service layers
- **[Deployment Architecture](../deployment.md)** - Infrastructure security and TLS/HTTPS setup

### Architecture Decisions (ADRs)
- **[Database Choice](../decisions/001-database-choice.md)** - Database-level security implications
- **[Validation Strategy](../decisions/002-validation-strategy.md)** - Input validation as first line of defense

### Design Patterns & Practices
- **[Security Patterns](../patterns/security-patterns.md)** - JWT token generation, BCrypt hashing, CORS
- **[Repository Pattern](../patterns/repository-pattern.md)** - Query-level security considerations

### Infrastructure & Deployment
- **[CI/CD Pipeline](../deployment/ci-pipeline.md)** - Secret management in GitHub Actions
- **[Staging Configuration](../deployment/staging-config.md)** - Security testing environment

---

**Document Version**: 1.0  
**Last Updated**: October 31, 2025  
**Status**: Production Ready
