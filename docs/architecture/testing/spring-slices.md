# Spring Boot Test Slices

**Purpose**: Guide to using Spring Boot's `@*Test` annotations to test horizontal slices of the application (controller layer, data layer, etc.) in isolation.

---

## Table of Contents

1. [What Are Test Slices?](#what-are-test-slices)
2. [Available Slices](#available-slices)
3. [WebMvcTest Pattern](#webmvctest-pattern)
4. [Other Slice Annotations](#other-slice-annotations)
5. [Mocking Strategy](#mocking-strategy)
6. [Examples from StockEase](#examples-from-stockease)
7. [When to Use Which](#when-to-use-which)
8. [Related Documentation](#related-documentation)

---

## What Are Test Slices?

### Definition
A test slice loads **only the layers needed to test a specific functionality**, not the entire application.

### Benefits
| Benefit | Impact |
|---------|--------|
| **Faster** | Load only web layer (100ms) instead of full app (1-2s) |
| **Focused** | No database overhead; test HTTP logic in isolation |
| **Clearer** | Easy to see what's being tested (just the controller) |
| **Cacheable** | Spring can cache contexts across similar slice tests |

### Comparison: Full vs. Slice

```
Full Spring Context (@SpringBootTest)
├─ Web Layer (Controllers)
├─ Service Layer
├─ Repository Layer
├─ Database Layer
├─ Security Configuration
└─ All Beans

Execution: ~2-3 seconds per test
Use: Integration tests, application bootstrap


Web Layer Slice (@WebMvcTest)
├─ Web Layer (Controllers only)
├─ Security Configuration
└─ Relevant Beans

Execution: ~0.5-1 second per test
Use: REST API tests, controller logic
Excluded: Services, repositories, database
```

---

## Available Slices

### 1. @WebMvcTest (Web Layer Slicing)

**What it loads**: Controller + security configuration  
**What it excludes**: Services, repositories, database  
**When to use**: Testing REST endpoints (80% of your tests)

**Auto-configured beans**:
- `MockMvc` — HTTP client simulation
- Spring Security configuration
- `@Controller`, `@RestController` beans
- Exception handlers

**Not configured**:
- `@Service` beans (must mock)
- `@Repository` beans (must mock)
- Database connections

**Example**:
```java
@WebMvcTest(ProductController.class)
public class ProductFetchControllerTest {
    @Autowired private MockMvc mockMvc;
    @MockitoBean private ProductRepository productRepository;
    
    // MockMvc makes HTTP requests
    // ProductRepository is a mock
}
```

### 2. @DataJpaTest (Repository Layer Slicing)

**What it loads**: JPA repositories, Hibernate, embedded database  
**What it excludes**: Web layer, services  
**When to use**: Testing query methods on repositories

**Auto-configured beans**:
- `TestEntityManager` — Low-level JPA testing
- Embedded database (H2 by default)
- `@Repository` beans

**Not configured**:
- Controllers
- Services
- Security

**Example**:
```java
@DataJpaTest
public class ProductRepositoryTest {
    @Autowired private TestEntityManager entityManager;
    @Autowired private ProductRepository productRepository;
    
    @Test
    void testFindByQuantityLessThan() {
        // Test repository queries directly
    }
}
```

**Note**: Not currently used in StockEase (repositories are mocked in controller tests)

### 3. @SpringBootTest (Full Context)

**What it loads**: Entire application context  
**When to use**: Integration tests, context bootstrap  
**Execution**: Slowest (~2-3 seconds)

**Example**:
```java
@SpringBootTest
@ActiveProfiles("test")
class StockEaseApplicationTests {
    @Test
    void contextLoads() {
        // All beans are loaded and wired
    }
}
```

### 4. @WebFluxTest (Reactive Web)

**Not used in StockEase** (synchronous Spring MVC)

### 5. @RestClientTest (REST Client Slicing)

**Not used in StockEase** (no outbound HTTP clients)

### 6. @JsonTest (JSON Serialization)

**Not used in StockEase** (JSON tested indirectly in MockMvc tests)

---

## WebMvcTest Pattern

### Structure

```java
@WebMvcTest(ProductController.class)         // Load only this controller
@ExtendWith(MockitoExtension.class)           // Enable Mockito
public class ProductFetchControllerTest {
    
    @Autowired
    private MockMvc mockMvc;                  // HTTP client
    
    @MockitoBean
    private ProductRepository productRepository;  // Mocked dependency
    
    @MockitoBean
    private JwtUtil jwtUtil;                  // Mocked dependency
    
    @BeforeEach
    void resetMocks() {
        Mockito.reset(productRepository, jwtUtil);
        // Setup mock behavior
    }
    
    @Test
    void testEndpoint() throws Exception {
        // Use mockMvc.perform(get(...))
    }
}
```

### Key Components

#### 1. @WebMvcTest Parameter
Specifies which controller to load:
```java
@WebMvcTest(ProductController.class)  // Load ProductController
@WebMvcTest({ProductController.class, AuthController.class})  // Multiple
@WebMvcTest                           // Auto-detect (use first)
```

#### 2. @MockitoBean
Replaces a Spring bean with a Mockito mock:
```java
@MockitoBean
private ProductRepository productRepository;  // Mocked

// In test:
when(productRepository.findAll()).thenReturn(Arrays.asList(...));
```

**Difference from @Mock**:
- `@Mock` — Plain Mockito mock (not in Spring context)
- `@MockitoBean` — Spring-aware mock (injected into beans)

#### 3. MockMvc
Simulates HTTP requests without starting a real server:
```java
mockMvc.perform(get("/api/products")
    .with(user("testUser").roles("USER")))
.andExpect(status().isOk())
.andExpect(jsonPath("$[0].name").value("Product 1"));
```

#### 4. @BeforeEach
Reset mocks before each test to ensure isolation:
```java
@BeforeEach
void resetMocks() {
    Mockito.reset(productRepository, jwtUtil);
    Mockito.when(jwtUtil.validateToken(Mockito.anyString()))
        .thenReturn(true);
}
```

---

## Mocking Strategy

### What to Mock in @WebMvcTest

| Component | Mock? | Why |
|-----------|-------|-----|
| Repository | ✅ Yes | We're testing controller, not DB queries |
| Service | ✅ Yes | Same reason; test one layer at a time |
| JwtUtil | ✅ Yes | Avoid cryptographic overhead |
| AuthenticationManager | ✅ Yes | Avoid Spring Security internals |
| External API clients | ✅ Yes | Would require network calls |
| Controllers | ❌ No | We're testing these! |
| RequestMappings | ❌ No | We're testing these! |

### How to Mock: @MockitoBean

```java
@WebMvcTest(ProductController.class)
public class ProductCreateControllerTest {
    
    // This bean is MOCKED
    @MockitoBean
    private ProductRepository productRepository;
    
    // This bean is REAL (loaded by @WebMvcTest)
    @Autowired
    private MockMvc mockMvc;
    
    @Test
    void testCreateProduct() throws Exception {
        // Setup mock
        Product mockProduct = new Product("Test", 10, 100.0);
        mockProduct.setId(1L);
        when(productRepository.save(any(Product.class)))
            .thenReturn(mockProduct);
        
        // Test controller (real)
        mockMvc.perform(post("/api/products")
            .contentType(APPLICATION_JSON)
            .content("{\"name\": \"Test\", ...}")
            .with(csrf())
            .with(user("admin").roles("ADMIN")))
        
        // Assert response (controller's HTTP response)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Test"));
    }
}
```

### Mock Behavior Pattern

```java
// 1. Import Mockito
import static org.mockito.Mockito.*;

// 2. Setup mock in @BeforeEach
@MockitoBean
private ProductRepository productRepository;

@BeforeEach
void setupMocks() {
    // Define what the mock should return
    when(productRepository.findAll())
        .thenReturn(Arrays.asList(product1, product2));
    
    when(productRepository.findById(1L))
        .thenReturn(Optional.of(product1));
    
    when(productRepository.save(any(Product.class)))
        .thenReturn(product1);
    
    // Define what should happen with invalid input
    when(productRepository.findById(999L))
        .thenReturn(Optional.empty());
}

// 3. Use in test
mockMvc.perform(get("/api/products"))
    .andExpect(status().isOk());
    // Behind the scenes: Controller calls mock repository
    // Mock returns the predefined list
    // Controller serializes to JSON
    // MockMvc captures the response
```

---

## Examples from StockEase

### Example 1: ProductFetchControllerTest.java

```java
@ExtendWith(MockitoExtension.class)
@WebMvcTest(ProductController.class)  // Only web layer
public class ProductFetchControllerTest {
    
    @Autowired
    private MockMvc mockMvc;  // HTTP client
    
    @MockitoBean
    private ProductRepository productRepository;  // Mocked
    
    @MockitoBean
    private JwtUtil jwtUtil;  // Mocked
    
    @BeforeEach
    void resetMocks() {
        Mockito.reset(productRepository, jwtUtil);
        // Mock returns true for token validation
        Mockito.when(jwtUtil.validateToken(Mockito.anyString()))
            .thenReturn(true);
    }
    
    @Test
    void testGetProductByIdSuccess() throws Exception {
        Product product1 = new Product("Product 1", 10, 100.0);
        product1.setId(1L);
        
        // Setup mock repository
        when(productRepository.findById(1L))
            .thenReturn(Optional.of(product1));
        
        // Make HTTP request
        mockMvc.perform(get("/api/products/1")
            .with(user("testUser").roles("USER")))
        
        // Assert response
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Product 1"));
    }
}
```

### Example 2: ProductCreateControllerTest.java

```java
@WebMvcTest(ProductController.class)
@Import(TestConfig.class)  // Import shared test beans
public class ProductCreateControllerTest {
    
    @Autowired
    private MockMvc mockMvc;
    
    @Autowired
    private JwtUtil jwtUtil;  // From TestConfig (real/mocked)
    
    @MockitoBean
    private ProductRepository productRepository;  // Mocked here
    
    @Test
    void testValidProductCreation() throws Exception {
        // Given: Admin is authenticated
        Product product1 = new Product("Product 1", 10, 100.0);
        product1.setId(1L);
        product1.setTotalValue(1000.0);
        
        when(productRepository.save(any(Product.class)))
            .thenReturn(product1);
        
        // When: POST request with valid data
        mockMvc.perform(post("/api/products")
            .contentType(APPLICATION_JSON)
            .content("{\"name\": \"Product 1\", \"quantity\": 10, \"price\": 100.0}")
            .with(csrf())
            .with(user("adminUser").roles("ADMIN")))
        
        // Then: Product is created
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Product 1"))
        .andExpect(jsonPath("$.quantity").value(10));
    }
}
```

### Example 3: AuthControllerTest.java (Unit, Not Slice)

```java
// Note: This is a UNIT TEST, not a slice test
// It doesn't use @WebMvcTest
class AuthControllerTest {
    
    @Mock
    private AuthenticationManager authenticationManager;
    
    @Mock
    private JwtUtil jwtUtil;
    
    @InjectMocks
    private AuthController authController;  // Not @WebMvcTest!
    
    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);  // Plain Mockito
    }
    
    @Test
    void testLoginSuccess() {
        // No HTTP layer, just method calls
        ResponseEntity<ApiResponse<String>> response = 
            authController.login(loginRequest);
        
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
```

---

## When to Use Which

### ✅ Use @WebMvcTest When:
- Testing REST endpoint logic (controllers)
- Need to verify HTTP status codes
- Testing request/response serialization
- Need MockMvc for HTTP simulation

**Examples in StockEase**:
```
ProductFetchControllerTest — Testing GET /api/products
ProductCreateControllerTest — Testing POST /api/products
ProductUpdateControllerTest — Testing PUT /api/products/{id}
ProductDeleteControllerTest — Testing DELETE /api/products/{id}
```

### ✅ Use @DataJpaTest When:
- Testing repository query methods
- Need to verify database interactions
- Testing JPA entity mappings

**Not used in StockEase yet** (repositories are mocked)

### ✅ Use @SpringBootTest When:
- Testing full application flow (end-to-end)
- Verifying bean wiring across layers
- Testing application bootstrap

**Examples in StockEase**:
```
StockEaseApplicationTests — Verify context loads
```

### ✅ Use Plain @Test (Unit) When:
- Testing isolated business logic
- No Spring context needed
- Testing utilities, mappers, validators

**Examples in StockEase**:
```
AuthControllerTest — Testing auth logic with plain Mockito
```

---

## Common Pitfalls

### ❌ Pitfall 1: Too Many @WebMvcTest Classes
```java
// ❌ BAD: 3 separate test classes for same controller
@WebMvcTest(ProductController.class)
class ProductGetTest { }

@WebMvcTest(ProductController.class)
class ProductPostTest { }

@WebMvcTest(ProductController.class)
class ProductPutTest { }

// ✅ BETTER: Organize by operation
// ProductFetchControllerTest — All GET operations
// ProductCreateControllerTest — POST operation
// ProductUpdateControllerTest — PUT operation
```

### ❌ Pitfall 2: Mocking the Controller You're Testing
```java
// ❌ BAD: Don't mock the controller!
@WebMvcTest(ProductController.class)
public class ProductTest {
    @MockitoBean
    private ProductController productController;  // WRONG!
}

// ✅ CORRECT: Mock the dependencies
@WebMvcTest(ProductController.class)
public class ProductTest {
    @MockitoBean
    private ProductRepository productRepository;  // ✓ Mock the dependency
}
```

### ❌ Pitfall 3: Not Resetting Mocks
```java
// ❌ BAD: Mocks retain state between tests
@Test
void test1() {
    when(repo.findAll()).thenReturn(list1);
}

@Test
void test2() {
    // repo.findAll() might still return list1!
}

// ✅ CORRECT: Reset in @BeforeEach
@BeforeEach
void resetMocks() {
    Mockito.reset(productRepository, jwtUtil);
    Mockito.when(jwtUtil.validateToken(...)).thenReturn(true);
}
```

### ❌ Pitfall 4: Over-Mocking
```java
// ❌ BAD: Mocking everything defeats the purpose
@WebMvcTest(ProductController.class)
public class ProductTest {
    @MockitoBean private ProductRepository repo;
    @MockitoBean private ProductService service;
    @MockitoBean private ProductValidator validator;
    // Now we're not testing anything real!
}

// ✅ BETTER: Mock only external dependencies
@WebMvcTest(ProductController.class)
public class ProductTest {
    @MockitoBean private ProductRepository repo;  // External dependency
    // Services and validators are real (part of controller's concern)
}
```

---

## Related Documentation

### Testing Fundamentals
- **[Testing Strategy](./strategy.md)** — Goals and philosophy
- **[Test Pyramid](./pyramid.md)** — Unit/slice/integration breakdown
- **[Naming Conventions](./naming-conventions.md)** — Test method naming

### Implementation
- **[Controller Integration Tests](./controller-integration.md)** — MockMvc details
- **[Test Data & Fixtures](./test-data-fixtures.md)** — TestConfig, mock data
- **[Security Tests](./security-tests.md)** — Role-based testing

### Main Architecture
- **[Testing Architecture](../testing-architecture.md)** — Entry point
- **[Backend Architecture](../backend.md)** — Controllers being tested

---

**Last Updated**: October 31, 2025  
**Version**: 1.0  
**Status**: ✅ Based on StockEase implementation

[Back to Testing Index](../testing-architecture.md)
