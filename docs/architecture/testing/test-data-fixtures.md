# Test Data & Fixtures

**Purpose**: Document how test data is created, configured, and managed in StockEase tests.

---

## TestConfig Bean Setup

`TestConfig.java` provides shared mock beans used across all `@WebMvcTest` classes.

**Location**: `backend/src/test/java/com/stocks/stockease/config/test/TestConfig.java`

```java
@Configuration
@SuppressWarnings("unused") // @Bean methods are invoked by Spring's CGLIB proxy at runtime
public class TestConfig {

    @Bean
    public JwtUtil jwtUtil() { return Mockito.mock(JwtUtil.class); }

    @Bean
    public UserDetailsService userDetailsService() { return Mockito.mock(UserDetailsService.class); }

    @Bean
    public JwtFilter jwtFilter(JwtUtil jwtUtil, UserDetailsService userDetailsService) {
        return new JwtFilter(jwtUtil, userDetailsService);
    }

    @Bean
    public SecurityContext securityContext() {
        // Both roles so tests cover ADMIN-only and USER-only @PreAuthorize paths without separate configs.
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(
                "testUser", "password",
                AuthorityUtils.createAuthorityList("ROLE_ADMIN", "ROLE_USER")));
        return context;
    }
}
```

JwtUtil stubs (`validateToken`, `extractUsername`) are set in each test's `@BeforeEach`, not in the factory method. Import in each test class with `@Import(TestConfig.class)`.

---

## Mock Data Initialization

```java
@BeforeEach
void setupTestData() {
    Product product1 = new Product("Product 1", 10, 100.0);
    product1.setId(1L);
    product1.setTotalValue(1000.0);

    Product lowStock = new Product("Low Stock", 2, 50.0);
    lowStock.setId(2L);

    when(productRepository.findAll()).thenReturn(Arrays.asList(product1, lowStock));
    when(productRepository.findById(1L)).thenReturn(Optional.of(product1));
    when(productRepository.findByQuantityLessThan(5)).thenReturn(Arrays.asList(lowStock));
}
```

---

## Test Properties

**File**: `backend/src/test/resources/application-test.properties`

```properties
spring.datasource.url=jdbc:h2:mem:testdb
spring.datasource.driver-class-name=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=

spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
spring.jpa.hibernate.ddl-auto=create-drop
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.open-in-view=false

spring.datasource.hikari.connection-test-query=SELECT 1
spring.datasource.hikari.maximum-pool-size=5
```

Activate with `@ActiveProfiles("test")` on `@SpringBootTest` classes.

---

## Mocking Strategies

```java
// Return a value
when(productRepository.findById(1L)).thenReturn(Optional.of(product));

// Return different values on successive calls
when(productRepository.findById(1L))
    .thenReturn(Optional.of(product1))
    .thenReturn(Optional.of(product2));

// Throw exception
when(productRepository.findById(999L))
    .thenThrow(new EntityNotFoundException("Not found"));

// Match any argument
when(productRepository.save(any(Product.class))).thenReturn(product);

// Verify call was made
verify(productRepository, times(1)).save(any(Product.class));
```

---

## Builder Pattern (Proposed)

For test classes that create many product variants, a builder reduces verbosity.

**Proposed location**: `backend/src/test/java/com/stocks/stockease/fixture/ProductBuilder.java`

```java
public class ProductBuilder {

    private Long id;
    private String name = "Default Product";
    private int quantity = 10;
    private double price = 100.0;

    public static ProductBuilder builder() { return new ProductBuilder(); }

    public ProductBuilder id(Long id) { this.id = id; return this; }
    public ProductBuilder name(String name) { this.name = name; return this; }
    public ProductBuilder quantity(int quantity) { this.quantity = quantity; return this; }
    public ProductBuilder price(double price) { this.price = price; return this; }

    public Product build() {
        Product p = new Product(name, quantity, price);
        if (id != null) p.setId(id);
        p.setTotalValue(quantity * price);
        return p;
    }
}
```

---

## Related Documentation

- **[Spring Slices](./spring-slices.md)** — TestConfig import pattern
- **[Security Tests](./security-tests.md)** — User mock data
- **[Controller Integration Tests](./controller-integration.md)** — Product mock examples

---

**Last Updated**: June 2026
**Status**: Current

[Back to Testing Architecture Index](testing-architecture.md)