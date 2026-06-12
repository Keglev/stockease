# Spring Test Slices

**Purpose**: Document the Spring Boot test slice annotations used in StockEase.

---

## What Are Test Slices?

A test slice loads only the part of the application context needed for a specific layer.

```java
// Without slices — loads everything, slow
@SpringBootTest
class ProductControllerTest { }

// With slices — loads only controller + security, fast
@WebMvcTest(ProductController.class)
class ProductControllerTest { }
```

| Annotation | Loads | Speed | Use For |
|------------|-------|-------|---------|
| `@WebMvcTest` | Controllers + Security | Fast | HTTP endpoint tests |
| `@DataJpaTest` | Repositories + JPA + H2 | Medium | Query tests |
| `@SpringBootTest` | Full context | Slow | Integration / bootstrap |
| None | Nothing | Fastest | Pure unit tests |

---

## @WebMvcTest

### What It Loads

```
@WebMvcTest(ProductController.class)
├── ProductController
├── MockMvc (auto-configured)
├── Spring Security filter chain
├── Jackson (JSON serialization)
├── ControllerAdvice
├── (mocked) Services
└── (mocked) Repositories
```

### Setup Pattern

```java
@WebMvcTest(ProductController.class)
@Import(TestConfig.class)
public class ProductFetchControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProductRepository productRepository;

    @Autowired
    private JwtUtil jwtUtil;  // From TestConfig

    @BeforeEach
    void setup() {
        Mockito.reset(productRepository, jwtUtil);
        when(jwtUtil.validateToken(anyString())).thenReturn(true);
    }
}
```

### Security in @WebMvcTest

Spring Security is active by default in `@WebMvcTest`. Use `SecurityMockMvcRequestPostProcessors` to provide test users:

```java
// Authenticated user with role
.with(user("admin").roles("ADMIN"))

// Anonymous (no auth) — omit .with(user(...))

// Full UserDetails
.with(user("admin").password("password").roles("ADMIN", "USER"))
```

---

## @DataJpaTest

### What It Loads

```
@DataJpaTest
├── Repository interfaces
├── H2 in-memory database
├── @Entity classes
├── TestEntityManager
└── (not loaded) Controllers, Services, Security
```

### When to Use

Use `@DataJpaTest` when testing custom `@Query` methods or derived query methods that need real SQL execution.

```java
@DataJpaTest
class ProductRepositoryTest {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private TestEntityManager entityManager;

    @BeforeEach
    void setup() {
        Product p = new Product("Test Product", 3, 50.0);
        entityManager.persist(p);
        entityManager.flush();
    }

    @Test
    void testFindByQuantityLessThan() {
        List<Product> lowStock = productRepository.findByQuantityLessThan(5);
        assertThat(lowStock).hasSize(1);
        assertThat(lowStock.get(0).getName()).isEqualTo("Test Product");
    }
}
```

**Current status**: Not yet used in StockEase. Repositories are mocked in slice tests.
**When to add**: Once custom queries grow in complexity.

---

## @SpringBootTest

Loads the full application context. Use only for:
- Verifying that all beans wire correctly on startup
- Multi-layer integration scenarios (rare)

```java
@SpringBootTest
@ActiveProfiles("test")
class StockEaseApplicationTests {

    @Test
    void contextLoads() { }
}
```

---

## Choosing the Right Annotation

```
What do I want to test?
├── HTTP endpoint behavior? → @WebMvcTest
├── Database query methods? → @DataJpaTest
├── Full bean wiring?       → @SpringBootTest
└── Pure business logic?    → No annotation + @ExtendWith(MockitoExtension.class)
```

---

## TestConfig Pattern

Centralizes shared mock beans to avoid repeating the same `@MockitoBean` setup in every test class.

```java
// backend/src/test/java/com/stocks/stockease/config/test/TestConfig.java

@Configuration
public class TestConfig {

    @Bean
    public JwtUtil jwtUtil() {
        JwtUtil mock = Mockito.mock(JwtUtil.class);
        when(mock.validateToken(anyString())).thenReturn(true);
        when(mock.extractUsername(anyString())).thenReturn("testUser");
        return mock;
    }
}
```

Import in each test class:

```java
@WebMvcTest(ProductController.class)
@Import(TestConfig.class)
class ProductFetchControllerTest { }
```

---

## Related Documentation

- **[Controller Integration Tests](./controller-integration.md)** — MockMvc request and assertion patterns
- **[Security Tests](./security-tests.md)** — Security setup in slices
- **[Test Data & Fixtures](./test-data-fixtures.md)** — TestConfig and mock data
- **[Troubleshooting](./troubleshooting.md)** — Common slice errors and fixes

---

**Last Updated**: June 2026
**Status**: Current

[Back to Testing Architecture Index](testing-architecture.md)
