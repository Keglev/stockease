# Test Data & Fixtures

**Purpose**: Document how test data is created, configured, and managed in StockEase tests.

---

## Table of Contents

1. [TestConfig Bean Setup](#testconfig-bean-setup)
2. [Mock Data Initialization](#mock-data-initialization)
3. [Test Properties](#test-properties)
4. [Mocking Strategies](#mocking-strategies)
5. [Builder Patterns](#builder-patterns)
6. [Related Documentation](#related-documentation)

---

## TestConfig Bean Setup

### Purpose
`TestConfig.java` provides shared mock beans and configuration used across all test classes.

**Location**: `backend/src/test/java/com/stocks/stockease/config/test/TestConfig.java`

```java
@Configuration
public class TestConfig {
    
    /**
     * Mock JwtUtil to avoid cryptographic operations in tests.
     */
    @Bean
    public JwtUtil jwtUtil() {
        return Mockito.mock(JwtUtil.class);
    }
    
    /**
     * Pre-configured SecurityContext for test users.
     */
    @Bean
    public SecurityContext securityContext() {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(
            "testUser",
            "password",
            AuthorityUtils.createAuthorityList("ROLE_ADMIN", "ROLE_USER")
        ));
        return context;
    }
}
```

### Using TestConfig

```java
@WebMvcTest(ProductController.class)
@Import(TestConfig.class)  // Import shared beans
public class ProductCreateControllerTest {
    
    @Autowired
    private JwtUtil jwtUtil;  // From TestConfig
    
    @BeforeEach
    void setupMocks() {
        Mockito.when(jwtUtil.validateToken(Mockito.anyString()))
            .thenReturn(true);
    }
}
```

---

## Mock Data Initialization

### Pattern: Setup Test Objects

```java
@BeforeEach
void setupTestData() {
    // User test data
    User testUser = new User(1L, "testuser", "password", "ROLE_USER");
    User adminUser = new User(2L, "admin", "password", "ROLE_ADMIN");
    
    // Product test data
    Product product1 = new Product("Product 1", 10, 100.0);
    product1.setId(1L);
    product1.setTotalValue(1000.0);
    
    Product product2 = new Product("Low Stock", 2, 50.0);
    product2.setId(2L);
    product2.setTotalValue(100.0);
    
    // Setup mocks
    when(productRepository.findAll())
        .thenReturn(Arrays.asList(product1, product2));
    when(productRepository.findById(1L))
        .thenReturn(Optional.of(product1));
    when(productRepository.findByQuantityLessThan(5))
        .thenReturn(Arrays.asList(product2));
}
```

### Product Mock Examples

```java
// Simple product
Product product = new Product("Test Product", 10, 100.0);
product.setId(1L);

// Low-stock product
Product lowStock = new Product("Low Stock", 2, 50.0);
lowStock.setId(2L);

// High-value product
Product expensive = new Product("Expensive", 1, 5000.0);
expensive.setId(3L);
expensive.setTotalValue(5000.0);
```

---

## Test Properties

### Test Database Configuration

**File**: `backend/src/test/resources/application-test.properties`

```properties
# In-memory H2 database (fast, no cleanup needed)
spring.datasource.url=jdbc:h2:mem:testdb
spring.datasource.driver-class-name=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=

# Hibernate with H2
spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
spring.jpa.hibernate.ddl-auto=create-drop
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true

# Connection pooling
spring.datasource.hikari.connection-test-query=SELECT 1
spring.datasource.hikari.maximum-pool-size=5

# Spring features
spring.jpa.open-in-view=false
```

### Active Test Profile

```java
@SpringBootTest
@ActiveProfiles("test")  // Loads application-test.properties
class StockEaseApplicationTests {
    @Test
    void contextLoads() { }
}
```

---

## Mocking Strategies

### Strategy 1: Simple Return Value

```java
@MockitoBean
private ProductRepository productRepository;

@BeforeEach
void setup() {
    Product product = new Product("Test", 10, 100.0);
    when(productRepository.findById(1L))
        .thenReturn(Optional.of(product));
}
```

### Strategy 2: Return Different Values

```java
when(productRepository.findById(1L))
    .thenReturn(Optional.of(product1))
    .thenReturn(Optional.of(product2));  // Second call
```

### Strategy 3: Throw Exception

```java
when(productRepository.findById(999L))
    .thenThrow(new EntityNotFoundException("Not found"));
```

### Strategy 4: Use ArgumentMatchers

```java
// Match any Product argument
when(productRepository.save(any(Product.class)))
    .thenReturn(product);

// Match specific value
when(productRepository.findById(eq(1L)))
    .thenReturn(Optional.of(product));

// Match with condition
when(productRepository.findByQuantityLessThan(anyInt()))
    .thenReturn(list);
```

### Strategy 5: Verify Mock Was Called

```java
@Test
void testProductCreation() throws Exception {
    mockMvc.perform(post("/api/products")
        .with(csrf())
        .with(user("admin").roles("ADMIN"))
        .content("{...}"))
    .andExpect(status().isOk());
    
    // Verify repository was called with any Product
    verify(productRepository, times(1))
        .save(any(Product.class));
}
```

---

## Builder Patterns

### Why Builders?

Instead of:
```java
// ❌ Verbose
Product p = new Product("name", 10, 100.0);
p.setId(1L);
p.setTotalValue(1000.0);
```

Use (future):
```java
// ✅ Fluent
Product p = ProductBuilder.builder()
    .id(1L)
    .name("name")
    .quantity(10)
    .price(100.0)
    .totalValue(1000.0)
    .build();
```

### Future Implementation

**File**: `backend/src/test/java/com/stocks/stockease/fixture/ProductBuilder.java` (proposed)

```java
public class ProductBuilder {
    
    private Long id;
    private String name = "Default Product";
    private int quantity = 10;
    private double price = 100.0;
    private double totalValue = 1000.0;
    
    public static ProductBuilder builder() {
        return new ProductBuilder();
    }
    
    public ProductBuilder id(Long id) {
        this.id = id;
        return this;
    }
    
    public ProductBuilder name(String name) {
        this.name = name;
        return this;
    }
    
    public Product build() {
        Product product = new Product(name, quantity, price);
        if (id != null) product.setId(id);
        product.setTotalValue(totalValue);
        return product;
    }
}
```

---

## Related Documentation

### Testing Fundamentals
- **[Testing Strategy](./strategy.md)** — Test data philosophy
- **[Spring Slices](./spring-slices.md)** — @MockitoBean patterns
- **[Naming Conventions](./naming-conventions.md)** — Test data naming

### Implementation Examples
- **[Security Tests](./security-tests.md)** — User mock data
- **[Controller Integration Tests](./controller-integration.md)** — Product data examples

### Main Architecture
- **[Testing Architecture](../testing-architecture.md)** — Entry point
- **[Backend Architecture](../backend.md)** — Models and entities

---

**Last Updated**: October 31, 2025  
**Version**: 1.0  
**Status**: ✅ Reflects current StockEase test data setup

[Back to Testing Index](../testing-architecture.md)
