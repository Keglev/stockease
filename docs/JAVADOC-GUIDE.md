# StockEase JavaDoc & Comments Guide

**Purpose**: Establish lean JavaDoc + enterprise-level inline comments for OpenAPI/ReDoc generation and future code maintenance.

**Philosophy**: 
- **Lean JavaDoc** → OpenAPI extraction for API documentation
- **Enterprise Comments** → Code logic explanation for future maintainers
- **Self-documenting Code** → Clear variable/method names reduce need for comments

---

## JavaDoc Template Patterns

### 1. Controller Class

```java
/**
 * REST controller handling authentication operations.
 * 
 * Manages user login and JWT token generation for API access.
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    // ...
}
```

### 2. Controller Methods (Public API Endpoints)

```java
/**
 * Authenticates user credentials and generates JWT token.
 * 
 * Validates username and password against stored user records,
 * then issues a signed JWT token with user role embedded.
 * 
 * @param loginRequest contains username and password
 * @return JWT token in ApiResponse wrapper if successful
 * @throws BadCredentialsException if credentials are invalid
 * @throws UsernameNotFoundException if user does not exist
 * @throws org.springframework.validation.BindException if validation fails
 */
@PostMapping("/login")
public ResponseEntity<ApiResponse<String>> login(@Valid @RequestBody LoginRequest loginRequest) {
    // Implementation
}
```

### 3. Model/Entity Class

```java
/**
 * Domain entity representing a Product in the inventory system.
 * 
 * Persisted to the "product" table. Maintains quantity and price
 * with automatic calculation of total stock value.
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@Data
@Entity
@Table(name = "product")
public class Product {
    
    /**
     * Unique identifier for the product (auto-generated).
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    /**
     * Product name. Required and must be unique.
     */
    @Column(nullable = false, unique = true)
    private String name;
    
    // ... other fields
}
```

### 4. Repository Interface

```java
/**
 * Spring Data JPA repository for Product entity.
 * 
 * Provides database access methods for product queries
 * and persistence operations.
 */
public interface ProductRepository extends JpaRepository<Product, Long> {
    
    /**
     * Finds all products ordered by ID in ascending order.
     * 
     * @return list of all products sorted by ID
     */
    @Query("SELECT p FROM Product p ORDER BY p.id ASC")
    List<Product> findAllOrderById();
    
    // ... other methods
}
```

### 5. DTO Class

```java
/**
 * Data Transfer Object for login requests.
 * 
 * Encapsulates user credentials sent to the login endpoint.
 * Validation constraints are applied during deserialization.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequest {
    
    /**
     * Username for authentication. Must not be blank.
     */
    @NotBlank(message = "Username is required")
    private String username;
    
    /**
     * Password for authentication. Must not be blank.
     */
    @NotBlank(message = "Password is required")
    private String password;
}
```

### 6. Configuration Class

```java
/**
 * Security configuration for Spring Security and JWT authentication.
 * 
 * Configures HTTP security, JWT filter, authentication manager,
 * and CORS policy for API access.
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {
    
    /**
     * Configures the security filter chain.
     * 
     * Sets up authentication entry point, JWT filter,
     * CORS configuration, and authorization rules.
     * 
     * @param http the HttpSecurity object to configure
     * @return configured SecurityFilterChain
     * @throws Exception if configuration fails
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // Implementation
    }
}
```

### 7. Utility/Helper Class

```java
/**
 * JWT token generation and validation utility.
 * 
 * Handles creation of signed JWT tokens with embedded user roles,
 * token validation, and expiration checks.
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@Component
public class JwtUtil {
    
    /**
     * Generates a signed JWT token for authenticated user.
     * 
     * Token includes username, role, and expiration timestamp.
     * Signed with configured secret key.
     * 
     * @param username the authenticated user's username
     * @param role the user's assigned role (ADMIN or USER)
     * @return signed JWT token string
     */
    public String generateToken(String username, String role) {
        // Implementation
    }
}
```

---

## Enterprise-Level Inline Comments

### When to Add Comments

✅ **DO ADD comments for:**
- Complex business logic (why, not what)
- Non-obvious algorithms
- Performance-critical sections
- Security-sensitive operations
- Validation rules with business meaning
- Database query optimizations

❌ **DON'T ADD comments for:**
- Self-explanatory code
- Obvious method names
- Standard CRUD operations
- Simple conditional logic

### Comment Style Examples

#### Example 1: Business Rule
```java
// Only ADMIN users can modify product prices directly.
// USER role requests are rejected by @PreAuthorize annotation.
@PreAuthorize("hasRole('ADMIN')")
@PutMapping("/{id}")
public ResponseEntity<ApiResponse<Product>> updateProduct(...) {
    // Implementation
}
```

#### Example 2: Performance Optimization
```java
// Use paginated query to avoid loading entire product table into memory.
// Default page size is 10 items; can be configured via request parameter.
Pageable pageable = PageRequest.of(page, size);
Page<Product> products = productRepository.findAll(pageable);
```

#### Example 3: Security Logic
```java
// Validate JWT signature to ensure token wasn't tampered with.
// Expired tokens are automatically rejected by JWT library.
boolean isValid = Jwts.parserBuilder()
    .setSigningKey(key)
    .build()
    .parseClaimsJws(token)
    .getBody() != null;
```

#### Example 4: Database Constraint
```java
// Product name must be unique to prevent duplicate inventory entries.
// Database enforces constraint; application handles gracefully on conflict.
@Column(nullable = false, unique = true)
private String name;
```

#### Example 5: Complex Calculation
```java
// Recalculate total value whenever quantity changes.
// Formula: totalValue = quantity * price (prevents out-of-sync values).
public void setQuantity(Integer quantity) {
    this.quantity = quantity;
    this.totalValue = quantity * this.price;
}
```

---

## File-by-File Commenting Order

### Priority 1: Controllers (API Entry Points)
Files to comment:
- `AuthController.java` - Login endpoint, token generation
- `ProductController.java` - CRUD endpoints, filtering, pagination

Pattern:
- Class JavaDoc with brief description
- Each public method: what it does, parameters, return value, exceptions
- Inline comments: authorization logic, validation rules

### Priority 2: DTOs & Exceptions
Files to comment:
- `dto/*.java` - LoginRequest, ApiResponse, PaginatedResponse
- `exception/*.java` - Custom exception classes

Pattern:
- Class JavaDoc describing data structure
- Field JavaDoc for validation constraints
- Brief inline comments for non-obvious defaults

### Priority 3: Models/Entities
Files to comment:
- `model/Product.java` - Entity mapping, constraints
- `model/User.java` - Entity mapping, role definitions

Pattern:
- Class JavaDoc with entity purpose
- Field JavaDoc with column constraints
- Inline comments for calculated fields or business rules

### Priority 4: Repositories
Files to comment:
- `repository/ProductRepository.java` - Custom queries
- `repository/UserRepository.java` - Custom queries

Pattern:
- Class JavaDoc with persistence scope
- Each custom query: what data is retrieved, why custom query needed

### Priority 5: Security Components
Files to comment:
- `security/JwtUtil.java` - Token generation/validation
- `security/JwtFilter.java` - Token extraction/validation
- `security/SecurityConfig.java` - Overall config
- `security/CustomUserDetailsService.java` - User loading
- `security/CustomAuthenticationEntryPoint.java` - Error handling

Pattern:
- Class JavaDoc with security purpose
- Method JavaDoc explaining cryptographic operations
- Inline comments: security decisions, why specific algorithms used

### Priority 6: Configuration
Files to comment:
- `config/*.java` - Application beans, properties

Pattern:
- Class JavaDoc describing configuration scope
- Method JavaDoc for each @Bean explaining its purpose
- Inline comments: why specific configuration values chosen

### Priority 7: Application Main Class
Files to comment:
- `StockEaseApplication.java` - Entry point

Pattern:
- Class JavaDoc with project description
- Brief main method comment if custom initialization

---

## OpenAPI Annotations (For Enhanced Generation)

Add these annotations alongside JavaDoc for better OpenAPI generation:

```java
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "User login and token management")
public class AuthController {
    
    @PostMapping("/login")
    @Operation(
        summary = "Login user",
        description = "Authenticate with username/password and receive JWT token"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "Login successful, JWT token returned"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "401",
        description = "Invalid credentials"
    )
    public ResponseEntity<ApiResponse<String>> login(@Valid @RequestBody LoginRequest loginRequest) {
        // Implementation
    }
}
```

---

## Checklist for Each File

- [ ] Class has JavaDoc comment with description
- [ ] Class has `@author`, `@version` tags
- [ ] Each public method has JavaDoc
- [ ] Public methods have `@param` for each parameter
- [ ] Public methods have `@return` describing return value
- [ ] Public methods have `@throws` for checked exceptions
- [ ] Complex logic sections have inline comments (why, not what)
- [ ] All fields in Models/DTOs have JavaDoc or `@` annotations
- [ ] Security-sensitive code has explanatory inline comments
- [ ] Validation rules have business-logic comments
- [ ] No commented-out code (remove or explain)
- [ ] No TODO comments without assigned owner/date

---

## Validation Commands

Once commenting is complete:

```bash
# Check for missing JavaDoc
mvn checkstyle:check

# Generate OpenAPI spec
mvn springdoc-openapi:generate-openapi

# View generated OpenAPI YAML
cat target/openapi.yaml
```

---

## Next Steps

1. Start with **Priority 1 (Controllers)** - Most critical for API documentation
2. Move through priorities in order
3. After each file, verify comment correctness
4. Once all files commented, run Task 4 (Review & Validate)
5. Then proceed to OpenAPI generation (Task 5)

---

**Status**: Guide complete. Ready for file-by-file commenting.  
**Last Updated**: October 31, 2025  
**Version**: 1.0
