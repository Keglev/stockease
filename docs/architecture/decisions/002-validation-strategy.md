# ADR 002: Validation Strategy - JSR-303 Annotations with Custom Validators

**Status**: Accepted  
**Date**: October 31, 2025  
**Authors**: Architecture Team  
**Stakeholders**: Backend Team, Security Team

## Problem Statement

StockEase needs to validate user input across multiple layers. We need to decide:
1. Where to perform validation (client, API, business logic)
2. How to validate (framework, custom code, third-party)
3. How to handle validation errors
4. How to ensure consistency

### Validation Requirements
- ✅ Prevent invalid data from entering system
- ✅ Consistent error responses
- ✅ Security validation (prevent injection)
- ✅ Business rule validation
- ✅ User-friendly error messages
- ✅ Fail-fast approach

## Decision

**Validation Approach**: Multi-layer validation
1. **API Layer**: JSR-303 bean validation with annotations
2. **Service Layer**: Business rule validation
3. **Database Layer**: Constraints and triggers
4. **Error Handling**: Global exception handler with standardized responses

## Implementation Details

### 1. API Layer Validation (JSR-303)

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
    
    @Pattern(regexp = "^[A-Z0-9-]{3,50}$", message = "SKU format invalid")
    private String sku;
}
```

**Advantages**:
- Declarative validation
- Automatic by Spring MVC
- Consistent with Spring Boot conventions
- Easy to understand and maintain

**Execution**:
```
Request arrives → @Valid annotation triggers
→ MethodArgumentNotValidException if invalid
→ GlobalExceptionHandler catches and formats error
→ 400 Bad Request with detailed error messages
```

### 2. Service Layer Validation

```java
@Service
public class ProductService {
    public ProductDTO createProduct(CreateProductRequest request, UUID userId) {
        // Database-level checks
        if (productRepository.existsBySku(request.getSku())) {
            throw new ValidationException("SKU already exists");
        }
        
        // Business rule checks
        if (request.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ValidationException("Price must be positive");
        }
        
        // Authorization checks
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new EntityNotFoundException("User not found"));
        
        if (!user.getRole().equals(Role.ADMIN)) {
            throw new AuthorizationException("Only admins can create products");
        }
        
        // Create and persist
        Product product = new Product(request);
        return productRepository.save(product);
    }
}
```

### 3. Database Layer Constraints

```sql
-- Table constraints
ALTER TABLE products ADD CONSTRAINT uk_products_sku UNIQUE(sku);
ALTER TABLE products ADD CONSTRAINT chk_price_positive CHECK (price > 0);
ALTER TABLE products ADD CONSTRAINT chk_quantity_positive CHECK (quantity >= 0);

-- Foreign key constraints
ALTER TABLE products ADD CONSTRAINT fk_products_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id);

-- Non-null constraints
ALTER TABLE products ALTER COLUMN name SET NOT NULL;
ALTER TABLE products ALTER COLUMN price SET NOT NULL;
```

### 4. Error Response Format

```json
{
  "status": 400,
  "error": "Validation Failed",
  "message": "Input validation failed. See details.",
  "timestamp": "2025-10-31T10:30:00Z",
  "path": "/api/products",
  "details": [
    {
      "field": "name",
      "message": "Name must be 3-255 characters",
      "rejectedValue": "AB",
      "code": "Size"
    },
    {
      "field": "price",
      "message": "Price must be > 0",
      "rejectedValue": "-10",
      "code": "DecimalMin"
    }
  ]
}
```

## Validation Rules by Entity

### User Entity
```
Username:
  - Required, not blank
  - 3-50 characters
  - Alphanumeric + underscore only
  - Unique in database

Password:
  - Required
  - Minimum 8 characters
  - Must contain uppercase letter
  - Must contain number
  - Cannot be same as username

Email:
  - Required
  - Valid email format
  - Unique in database

Role:
  - Required
  - Must be ADMIN or USER
```

### Product Entity
```
Name:
  - Required, not blank
  - 3-255 characters

Description:
  - Optional
  - Max 2000 characters

Price:
  - Required
  - Greater than 0
  - Max 999,999.99

Quantity:
  - Required
  - >= 0
  - Max 1,000,000

SKU:
  - Required, not blank
  - 3-50 characters
  - Alphanumeric + hyphens only
  - Unique in database

Category:
  - Required, not blank
  - 3-50 characters
```

## Validation Flow Diagram

```
Request with JSON Body
  ↓
Spring MVC deserializes to POJO
  ↓
@Valid annotation triggers validation
  ↓
JSR-303 validator checks annotations
  ↓
If violations found:
  ├─→ MethodArgumentNotValidException
  └─→ GlobalExceptionHandler
      └─→ Format error response
          └─→ 400 Bad Request
  
If validation passes:
  ├─→ Controller method executes
  ├─→ Service layer performs business validation
  ├─→ If business validation fails:
  │   └─→ Custom exception (ValidationException)
  │       └─→ GlobalExceptionHandler
  │           └─→ 400 Bad Request
  └─→ If all validation passes:
      └─→ Database constraints enforced
          └─→ Data persisted
```

## Testing Strategy

### Unit Tests for Validators
```java
@Test
public void testNameValidation_TooShort() {
    CreateProductRequest request = new CreateProductRequest();
    request.setName("AB"); // Less than 3 chars
    
    Set<ConstraintViolation<CreateProductRequest>> violations = 
        validator.validate(request);
    
    assertTrue(violations.size() > 0);
    assertTrue(violations.iterator().next()
        .getMessage()
        .contains("3-255 characters"));
}
```

### Integration Tests
```java
@Test
public void testCreateProduct_InvalidPrice() {
    mockMvc.perform(post("/api/products")
        .header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
            {
              "name": "Widget",
              "price": -10,
              "sku": "WIDGET-001"
            }
            """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.details[0].field").value("price"));
}
```

## Alternatives Considered

### 1. Manual Validation in Controllers
**Rejected because**:
- Boilerplate code
- Error-prone
- Hard to maintain
- Not reusable across endpoints

### 2. Validation at DAO/Repository Level
**Rejected because**:
- Too late in the flow
- API responses won't be consistent
- Performance impact
- Mixing concerns

### 3. GraphQL Validation
**Rejected because**:
- Project uses REST API
- Overhead for current requirements
- Team expertise in REST validation
- Simpler to implement with JSR-303

## Consequences

### Positive
- ✅ Declarative, readable validation
- ✅ Consistent error responses
- ✅ Automatic by Spring
- ✅ Easy to add new rules
- ✅ Framework support for common patterns
- ✅ Good test coverage

### Negative
- ❌ Annotations can become verbose
- ❌ Custom validators require code
- ❌ Database constraints not always caught until persist
- ❌ Complex validations hard to express in annotations

## Mitigation Strategies

### For Complexity
- Create custom validators for complex rules
- Use @Validated at service level
- Document validation rules clearly
- Keep validation rules simple

### For Performance
- Validation is fast (< 1ms typically)
- Use database-level checks for unique constraints
- Cache validation metadata

## Related Decisions
- ADR 001: Database Choice (constraints at DB level)
- ADR 003: Error Handling Strategy

## Implementation Status
- ✅ JSR-303 validators in DTOs
- ✅ Global exception handler
- ✅ Standardized error responses
- ✅ 65+ tests with validation coverage
- ✅ Database constraints defined

## Security Considerations

### Input Sanitization
```java
// Spring Data JPA prevents SQL injection
// Parameterized queries used automatically

// HTML/XML encoding
@RequestBody CreateProductRequest request
// Spring automatically handles encoding
```

### Authorization Validation
```java
@Service
public class ProductService {
    public void deleteProduct(UUID id, UUID userId) {
        // Authorization check in service
        if (!isAdmin(userId)) {
            throw new AuthorizationException("Unauthorized");
        }
        // Prevent privilege escalation
    }
}
```

## Monitoring & Debugging

### Validation Metrics
- Count of validation failures per endpoint
- Most common validation errors
- Validation performance

### Debugging Tips
- Check error response `details` array
- Verify constraint annotations match rules
- Test each validator independently
- Review database constraint violations

---

**Document Version**: 1.0  
**Last Updated**: October 31, 2025  
**Approval**: ✅ Accepted
