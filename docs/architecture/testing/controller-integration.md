# Controller Integration Tests

**Purpose**: Document MockMvc patterns and HTTP testing practices used in StockEase controller tests.

---

## Table of Contents

1. [MockMvc Fundamentals](#mockmvc-fundamentals)
2. [HTTP Request Patterns](#http-request-patterns)
3. [Response Validation](#response-validation)
4. [JSON Path Assertions](#json-path-assertions)
5. [Product CRUD Test Examples](#product-crud-test-examples)
6. [Parameterized HTTP Tests](#parameterized-http-tests)
7. [Content Negotiation](#content-negotiation)
8. [Related Documentation](#related-documentation)

---

## MockMvc Fundamentals

### What is MockMvc?

MockMvc simulates HTTP requests to Spring controllers **without starting a real server**.

```
Normal Flow (Integration Test)
request → HTTP Server (port 8080) → Controller → Response

MockMvc Flow (Slice Test)
request → MockMvc → Controller → Response
(No network, no port binding)
```

### Benefits
- **Fast**: No server startup (< 1 second per test)
- **Focused**: Test controller logic, not HTTP server
- **Isolated**: Dependencies are mocked

### Setup

```java
@WebMvcTest(ProductController.class)
public class ProductControllerTest {
    
    @Autowired
    private MockMvc mockMvc;  // Injected by @WebMvcTest
    
    @MockitoBean
    private ProductRepository productRepository;  // Mocked
    
    // Ready to use mockMvc
}
```

---

## HTTP Request Patterns

### GET Request

```java
mockMvc.perform(get("/api/products"))
    .andExpect(status().isOk());
```

### GET with Path Variable

```java
mockMvc.perform(get("/api/products/1"))  // {id} = 1
    .andExpect(status().isOk());
```

### GET with Query Parameters

```java
mockMvc.perform(get("/api/products?page=0&size=10"))
    .andExpect(status().isOk());
```

### POST Request with JSON Body

```java
mockMvc.perform(post("/api/products")
    .contentType(APPLICATION_JSON)
    .content("{\"name\": \"Product\", \"quantity\": 10, \"price\": 100.0}")
    .with(csrf())
    .with(user("admin").roles("ADMIN")))
.andExpect(status().isOk());
```

### PUT Request (Update)

```java
mockMvc.perform(put("/api/products/1")
    .contentType(APPLICATION_JSON)
    .content("{\"name\": \"Updated\", \"quantity\": 20}")
    .with(csrf())
    .with(user("admin").roles("ADMIN")))
.andExpect(status().isOk());
```

### DELETE Request

```java
mockMvc.perform(delete("/api/products/1")
    .with(csrf())
    .with(user("admin").roles("ADMIN")))
.andExpect(status().isNoContent());
```

---

## Response Validation

### Status Code Assertions

```java
// Successful responses
.andExpect(status().isOk())              // 200
.andExpect(status().isCreated())         // 201
.andExpect(status().isNoContent())       // 204

// Client errors
.andExpect(status().isBadRequest())      // 400
.andExpect(status().isUnauthorized())    // 401
.andExpect(status().isForbidden())       // 403
.andExpect(status().isNotFound())        // 404

// Server errors
.andExpect(status().isInternalServerError())  // 500
```

### Content Type Assertions

```java
mockMvc.perform(get("/api/products"))
    .andExpect(content().contentType(APPLICATION_JSON));
```

### Response Body Assertions

```java
mockMvc.perform(get("/api/products"))
    .andExpect(content().json("{...}"));  // Match entire JSON
```

---

## JSON Path Assertions

### JsonPath Syntax

JsonPath allows querying JSON responses:

```
$.fieldName           — Root-level field
$[0]                  — First array element
$[*].name             — All names in array
$.data.id             — Nested field
```

### Examples from StockEase

#### Assert Single Field

```java
mockMvc.perform(get("/api/products/1"))
    .andExpect(jsonPath("$.name").value("Product 1"))
    .andExpect(jsonPath("$.quantity").value(10))
    .andExpect(jsonPath("$.price").value(100.0));
```

#### Assert Array Elements

```java
mockMvc.perform(get("/api/products"))
    .andExpect(jsonPath("$[0].name").value("Product 1"))
    .andExpect(jsonPath("$[1].name").value("Product 2"))
    .andExpect(jsonPath("$[*].id", containsInAnyOrder(1L, 2L)));
```

#### Assert Array Size

```java
mockMvc.perform(get("/api/products"))
    .andExpect(jsonPath("$", hasSize(2)));  // Array has 2 elements
```

#### Assert Field Existence

```java
mockMvc.perform(get("/api/products/1"))
    .andExpect(jsonPath("$.id").exists())        // Field exists
    .andExpect(jsonPath("$.name").exists());
```

#### Assert Nested Fields

```java
mockMvc.perform(get("/api/auth/login"))
    .andExpect(jsonPath("$.data").isString())     // JWT token
    .andExpect(jsonPath("$.message").value("Login successful"));
```

---

## Product CRUD Test Examples

### Example 1: GET All Products

**Test File**: `ProductFetchControllerTest.java`

```java
@Test
void testGetAllProducts() throws Exception {
    // Given
    Product product1 = new Product("Product 1", 10, 100.0);
    product1.setId(1L);
    
    Product product2 = new Product("Product 2", 5, 50.0);
    product2.setId(2L);
    
    when(productRepository.findAll())
        .thenReturn(Arrays.asList(product1, product2));
    
    // When / Then
    mockMvc.perform(get("/api/products")
        .with(user("testUser")))
    
    .andExpect(status().isOk())
    .andExpect(jsonPath("$", hasSize(2)))
    .andExpect(jsonPath("$[0].name").value("Product 1"))
    .andExpect(jsonPath("$[1].name").value("Product 2"));
}
```

### Example 2: POST Create Product (Admin Only)

**Test File**: `ProductCreateControllerTest.java`

```java
@Test
void testCreateProductAsAdmin() throws Exception {
    // Given
    Product product = new Product("New Product", 10, 100.0);
    product.setId(1L);
    product.setTotalValue(1000.0);
    
    when(productRepository.save(any(Product.class)))
        .thenReturn(product);
    
    // When / Then
    mockMvc.perform(post("/api/products")
        .contentType(APPLICATION_JSON)
        .content("{\"name\": \"New Product\", \"quantity\": 10, \"price\": 100.0}")
        .with(csrf())
        .with(user("admin").roles("ADMIN")))
    
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.id").value(1L))
    .andExpect(jsonPath("$.name").value("New Product"))
    .andExpect(jsonPath("$.quantity").value(10));
}
```

### Example 3: PUT Update Product

**Test File**: `ProductUpdateControllerTest.java`

```java
@Test
void testUpdateProduct() throws Exception {
    // Given
    Product product = new Product("Updated Product", 20, 150.0);
    product.setId(1L);
    
    when(productRepository.findById(1L))
        .thenReturn(Optional.of(product));
    when(productRepository.save(any(Product.class)))
        .thenReturn(product);
    
    // When / Then
    mockMvc.perform(put("/api/products/1")
        .contentType(APPLICATION_JSON)
        .content("{\"name\": \"Updated Product\", \"quantity\": 20, \"price\": 150.0}")
        .with(csrf())
        .with(user("admin").roles("ADMIN")))
    
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.name").value("Updated Product"))
    .andExpect(jsonPath("$.quantity").value(20));
}
```

### Example 4: DELETE Product

**Test File**: `ProductDeleteControllerTest.java`

```java
@Test
void testDeleteProduct() throws Exception {
    // Given
    Product product = new Product("Product to Delete", 10, 100.0);
    product.setId(1L);
    
    when(productRepository.findById(1L))
        .thenReturn(Optional.of(product));
    
    // When / Then
    mockMvc.perform(delete("/api/products/1")
        .with(csrf())
        .with(user("admin").roles("ADMIN")))
    
    // No content returned (204)
    .andExpect(status().isNoContent());
}
```

### Example 5: GET Product Not Found

**Test File**: `ProductFetchControllerTest.java`

```java
@Test
void testGetProductByIdNotFound() throws Exception {
    // Given
    when(productRepository.findById(999L))
        .thenReturn(Optional.empty());
    
    // When / Then
    mockMvc.perform(get("/api/products/999")
        .with(user("testUser")))
    
    .andExpect(status().isNotFound());
}
```

---

## Parameterized HTTP Tests

### Why Parameterized?

Test multiple scenarios with one method:

```java
@ParameterizedTest
@CsvSource({
    "adminUser, ADMIN, 200",      // Admin: allowed
    "regularUser, USER, 403"       // User: forbidden
})
void testCreateByRole(String user, String role, int expectedStatus) 
    throws Exception {
    
    mockMvc.perform(post("/api/products")
        .with(SecurityMockMvcRequestPostProcessors.user(user).roles(role))
        .with(csrf()))
    .andExpect(status().is(expectedStatus));
}
```

### Example: Testing Multiple Roles

**From ProductControllerTest.java**:

```java
@ParameterizedTest
@CsvSource({
    "adminUser, ADMIN",
    "regularUser, USER"
})
void testLowStockProductsWithRoles(String username, String role) throws Exception {
    // Setup
    Product product1 = new Product("Low Stock", 3, 50.0);
    product1.setId(1L);
    
    when(productRepository.findByQuantityLessThan(5))
        .thenReturn(Arrays.asList(product1));
    
    // Test: Both roles can fetch
    mockMvc.perform(get("/api/products/low-stock")
        .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
    
    .andExpect(status().isOk())
    .andExpect(jsonPath("$[0].name").value("Low Stock"));
}
```

---

## Content Negotiation

### Setting Content Type

```java
// Request sends JSON
mockMvc.perform(post("/api/products")
    .contentType(APPLICATION_JSON)
    .content("{...}"))

// Request sends form data
mockMvc.perform(post("/api/products")
    .contentType(APPLICATION_FORM_URLENCODED)
    .param("name", "Product"))

// Response expects JSON
mockMvc.perform(get("/api/products"))
    .andExpect(content().contentType(APPLICATION_JSON))
```

### Imports
```java
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.http.MediaType.APPLICATION_FORM_URLENCODED;
```

---

## Common HTTP Test Patterns

### Pattern: Successful CRUD Flow

```java
// 1. Create
mockMvc.perform(post("/api/products")
    .with(csrf())
    .with(user("admin").roles("ADMIN"))
    .content("{...}"))
.andExpect(status().isOk());

// 2. Read
mockMvc.perform(get("/api/products/1")
    .with(user("user")))
.andExpect(status().isOk());

// 3. Update
mockMvc.perform(put("/api/products/1")
    .with(csrf())
    .with(user("admin").roles("ADMIN"))
    .content("{...}"))
.andExpect(status().isOk());

// 4. Delete
mockMvc.perform(delete("/api/products/1")
    .with(csrf())
    .with(user("admin").roles("ADMIN")))
.andExpect(status().isNoContent());
```

### Pattern: Testing Error Cases

```java
// Missing required field
mockMvc.perform(post("/api/products")
    .contentType(APPLICATION_JSON)
    .content("{\"name\": \"\"}")  // Missing quantity, price
    .with(csrf())
    .with(user("admin").roles("ADMIN")))
.andExpect(status().isBadRequest());

// Invalid data type
mockMvc.perform(put("/api/products/1")
    .contentType(APPLICATION_JSON)
    .content("{\"quantity\": \"not a number\"}")
    .with(csrf())
    .with(user("admin").roles("ADMIN")))
.andExpect(status().isBadRequest());

// Not found
mockMvc.perform(get("/api/products/999")
    .with(user("testUser")))
.andExpect(status().isNotFound());
```

---

## MockMvc Debugging

### Print Request/Response

```java
mockMvc.perform(get("/api/products"))
    .andDo(print())  // Print HTTP details
    .andExpect(status().isOk());
```

### Output:
```
MockHttpServletRequest:
  HTTP Method = GET
  Request URI = /api/products
  Parameters = {}
  Headers = {Authorization=[Bearer ...]}

MockHttpServletResponse:
  Status = 200
  Content type = application/json
  Body = [{"id":1,"name":"Product 1",...}]
```

---

## Related Documentation

### Testing Fundamentals
- **[Testing Strategy](./strategy.md)** — HTTP testing scope
- **[Spring Slices](./spring-slices.md)** — @WebMvcTest details
- **[Naming Conventions](./naming-conventions.md)** — Test method names

### Security & Authorization
- **[Security Tests](./security-tests.md)** — Role-based HTTP tests
- **[Test Data & Fixtures](./test-data-fixtures.md)** — MockMvc setup

### Main Architecture
- **[Testing Architecture](../testing-architecture.md)** — Entry point
- **[Backend Architecture](../backend.md)** — Controllers being tested

---

**Last Updated**: October 31, 2025  
**Version**: 1.0  
**Status**: ✅ Based on StockEase controller test patterns

[Back to Testing Index](../testing-architecture.md)
