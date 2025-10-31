# Repository Pattern Implementation

## Overview

The Repository Pattern abstracts data access logic from business logic, providing a clean interface for CRUD operations and queries on aggregate roots.

## Implementation in StockEase

### Pattern Structure

```
Business Logic (Service)
    ↓ uses
Repository Interface (Spring Data JPA)
    ↓ extends
JpaRepository<T, ID>
    ↓ implements (Spring generates)
Repository Implementation (Proxy)
    ↓ uses
EntityManager (Hibernate)
    ↓ executes
SQL Queries
    ↓ accesses
PostgreSQL Database
```

## Repository Interfaces

### UserRepository

```java
public interface UserRepository extends JpaRepository<User, UUID> {
    // Spring Data JPA auto-generates implementation
    
    // Spring derives queries from method names
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
    
    // Custom queries using @Query
    @Query("""
        SELECT u FROM User u 
        WHERE u.role = :role 
        ORDER BY u.createdAt DESC
        """)
    List<User> findByRoleOrderByDate(@Param("role") Role role);
}
```

### ProductRepository

```java
public interface ProductRepository extends JpaRepository<Product, UUID> {
    // Query methods
    Optional<Product> findBySku(String sku);
    Page<Product> findByCategory(String category, Pageable pageable);
    List<Product> findByCreatedBy(UUID userId);
    
    // Exists check
    boolean existsBySku(String sku);
    
    // Custom query with parameters
    @Query("""
        SELECT p FROM Product p 
        WHERE p.price BETWEEN :minPrice AND :maxPrice
        AND p.quantity > 0
        ORDER BY p.price ASC
        """)
    List<Product> findAffordableInStock(
        @Param("minPrice") BigDecimal minPrice,
        @Param("maxPrice") BigDecimal maxPrice);
    
    // Using @Query with LIKE
    @Query("""
        SELECT p FROM Product p 
        WHERE LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%'))
        """)
    Page<Product> searchByName(
        @Param("search") String search,
        Pageable pageable);
}
```

## Query Method Naming Convention

Spring Data JPA generates queries from method names:

| Method Name | Generated Query |
|---|---|
| `findBySku(String sku)` | `SELECT * FROM products WHERE sku = ?` |
| `findByCategory(String cat)` | `SELECT * FROM products WHERE category = ?` |
| `findByCategoryAndPrice(String cat, BigDecimal price)` | `SELECT * FROM products WHERE category = ? AND price = ?` |
| `findByCategoryOrPrice(...)` | `SELECT * FROM products WHERE category = ? OR price = ?` |
| `findByPriceGreaterThan(BigDecimal price)` | `SELECT * FROM products WHERE price > ?` |
| `findByPriceLessThanEqual(BigDecimal price)` | `SELECT * FROM products WHERE price <= ?` |
| `findBySkuContaining(String sku)` | `SELECT * FROM products WHERE sku LIKE ?` |
| `findBySkuIn(List<String> skus)` | `SELECT * FROM products WHERE sku IN (?, ...)` |
| `existsBySku(String sku)` | `SELECT COUNT(*) > 0 FROM products WHERE sku = ?` |

## Usage Examples

### In Service Layer

```java
@Service
public class ProductService {
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    
    @Transactional(readOnly = true)
    public Page<ProductDTO> getProducts(
            int page, int size, String category) {
        
        Pageable pageable = PageRequest.of(page, size);
        Page<Product> products = productRepository
            .findByCategory(category, pageable);
        
        return products.map(ProductDTO::fromEntity);
    }
    
    @Transactional
    public ProductDTO createProduct(
            CreateProductRequest request, UUID userId) {
        
        // Check authorization
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new EntityNotFoundException("User not found"));
        
        if (!user.getRole().equals(Role.ADMIN)) {
            throw new AuthorizationException("Unauthorized");
        }
        
        // Check uniqueness
        if (productRepository.existsBySku(request.getSku())) {
            throw new ValidationException("SKU already exists");
        }
        
        // Create and save
        Product product = new Product(request);
        product.setCreatedBy(userId);
        
        Product saved = productRepository.save(product);
        return ProductDTO.fromEntity(saved);
    }
    
    @Transactional
    public void deleteProduct(UUID id, UUID userId) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Product not found"));
        
        productRepository.delete(product);
    }
}
```

## Pagination

### Using PageRequest

```java
// Get page 0 (first page) with 20 items per page
Pageable pageable = PageRequest.of(0, 20);
Page<Product> page = productRepository.findAll(pageable);

// With sorting
Pageable pageable = PageRequest.of(
    0, 20, 
    Sort.by(Sort.Order.asc("name")));
Page<Product> page = productRepository.findAll(pageable);

// Response to client
{
  "content": [...],
  "pageable": {
    "pageNumber": 0,
    "pageSize": 20,
    "sort": [{"property": "name", "direction": "ASC"}]
  },
  "totalElements": 150,
  "totalPages": 8,
  "last": false,
  "size": 20,
  "number": 0,
  "sort": [...]
}
```

## Custom Queries with @Query

### JPQL (Java Persistence Query Language)

```java
// JPQL uses entity names, not table names
@Query("SELECT p FROM Product p WHERE p.price > :minPrice")
List<Product> findExpensiveProducts(@Param("minPrice") BigDecimal minPrice);

// With joins
@Query("""
    SELECT p FROM Product p 
    JOIN p.createdBy user
    WHERE user.username = :username
    """)
List<Product> findProductsByCreator(@Param("username") String username);

// With GROUP BY
@Query("""
    SELECT p.category, COUNT(p) 
    FROM Product p 
    GROUP BY p.category
    ORDER BY COUNT(p) DESC
    """)
List<Object[]> getTopCategories();
```

### Native SQL

```java
@Query(
    value = """
        SELECT p.* FROM products p
        WHERE p.created_at > NOW() - INTERVAL '7 days'
        ORDER BY p.price DESC
        """,
    nativeQuery = true
)
List<Product> findRecentProducts();
```

## Transaction Management

### Read-Only Transactions

```java
@Transactional(readOnly = true)
public Page<ProductDTO> getProducts(Pageable pageable) {
    // Database optimizations for read-only
    // No locks held after query
    // Can rollback if needed
    return productRepository.findAll(pageable);
}
```

### Write Transactions

```java
@Transactional
public void createAndAudit(CreateProductRequest request) {
    // Both operations succeed or both rollback
    Product product = productRepository.save(new Product(request));
    auditRepository.save(new AuditEvent(product.getId(), "CREATE"));
}

// If auditRepository.save throws exception:
// Product save is rolled back automatically
```

## Advanced Patterns

### Specifications (Dynamic Queries)

```java
public interface ProductRepository 
        extends JpaRepository<Product, UUID>,
                JpaSpecificationExecutor<Product> {
}

// Usage in service
public Page<ProductDTO> searchProducts(
        String name, String category, BigDecimal maxPrice, Pageable pageable) {
    
    Specification<Product> spec = Specification
        .where(nameContains(name))
        .and(categoryEquals(category))
        .and(priceLessThan(maxPrice));
    
    return productRepository.findAll(spec, pageable);
}

private static Specification<Product> nameContains(String name) {
    return (root, query, cb) -> 
        name == null ? null : 
        cb.like(cb.lower(root.get("name")), "%" + name.toLowerCase() + "%");
}
```

### Projections (Partial Data)

```java
public interface ProductSummary {
    UUID getId();
    String getName();
    BigDecimal getPrice();
}

public interface ProductRepository extends JpaRepository<Product, UUID> {
    // Returns only specific fields
    List<ProductSummary> findByCategory(String category);
}

// Usage
List<ProductSummary> summaries = productRepository.findByCategory("electronics");
```

## Performance Considerations

### N+1 Query Problem

```java
// ❌ PROBLEM: N+1 queries
List<Product> products = productRepository.findAll();
for (Product p : products) {
    User creator = p.getCreatedBy(); // Additional query per product!
}

// ✅ SOLUTION: Eager loading
@Query("""
    SELECT DISTINCT p FROM Product p 
    LEFT JOIN FETCH p.createdBy
    """)
List<Product> findAllWithCreator();
```

### Lazy vs Eager Loading

```java
@Entity
public class Product {
    @ManyToOne(fetch = FetchType.LAZY)
    private User createdBy; // Only loaded when accessed
    
    @OneToMany(fetch = FetchType.EAGER)
    private Set<Review> reviews; // Always loaded
}
```

### Query Caching

```java
@Cacheable("products")
public ProductDTO getProductById(UUID id) {
    return productRepository.findById(id)
        .map(ProductDTO::fromEntity)
        .orElse(null);
}
```

## Testing Repository Methods

```java
@DataJpaTest
public class ProductRepositoryTest {
    @Autowired
    private ProductRepository repository;
    
    @Test
    public void testFindBySku() {
        Product product = new Product("Widget", "WIDGET-001");
        repository.save(product);
        
        Optional<Product> found = repository.findBySku("WIDGET-001");
        assertTrue(found.isPresent());
        assertEquals("Widget", found.get().getName());
    }
}
```

## Best Practices

1. **Repository per Aggregate**
   - One repository per entity
   - Don't cross repository boundaries in queries

2. **Keep Queries Simple**
   - Use method naming for simple queries
   - Use @Query for complex logic
   - Avoid N+1 problems

3. **Transaction Boundaries**
   - Mark read operations as @Transactional(readOnly = true)
   - Use @Transactional for write operations

4. **Error Handling**
   - Throw domain exceptions, not SQL exceptions
   - Let service layer handle exceptions

5. **Testing**
   - Test repository methods independently
   - Use @DataJpaTest for unit tests
   - Use mock repositories in service tests

---

**Document Version**: 1.0  
**Last Updated**: October 31, 2025  
**Status**: Production Ready
