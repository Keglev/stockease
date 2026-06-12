# Controller Integration Tests

**Purpose**: Document MockMvc HTTP testing patterns used in StockEase controller tests.

---

## MockMvc Overview

MockMvc simulates HTTP requests to Spring controllers without starting a real server.

```
Real server flow:   request → HTTP port 8080 → Controller → Response
MockMvc flow:       request → MockMvc → Controller → Response
```

Setup via `@WebMvcTest` — MockMvc is auto-injected:

```java
@WebMvcTest(ProductController.class)
@Import(TestConfig.class)
public class ProductFetchControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProductRepository productRepository;
}
```

---

## HTTP Request Patterns

```java
// GET
mockMvc.perform(get("/api/products").with(user("testUser")))
    .andExpect(status().isOk());

// GET with path variable
mockMvc.perform(get("/api/products/1").with(user("testUser")))
    .andExpect(status().isOk());

// GET with query parameters
mockMvc.perform(get("/api/products?page=0&size=10").with(user("testUser")))
    .andExpect(status().isOk());

// POST
mockMvc.perform(post("/api/products")
    .contentType(APPLICATION_JSON)
    .content("{\"name\": \"Product\", \"quantity\": 10, \"price\": 100.0}")
    .with(csrf())
    .with(user("admin").roles("ADMIN")))
    .andExpect(status().isOk());

// PUT
mockMvc.perform(put("/api/products/1")
    .contentType(APPLICATION_JSON)
    .content("{\"name\": \"Updated\", \"quantity\": 20}")
    .with(csrf())
    .with(user("admin").roles("ADMIN")))
    .andExpect(status().isOk());

// DELETE
mockMvc.perform(delete("/api/products/1")
    .with(csrf())
    .with(user("admin").roles("ADMIN")))
    .andExpect(status().isNoContent());
```

---

## Response Assertions

### Status Codes

```java
.andExpect(status().isOk())              // 200
.andExpect(status().isNoContent())       // 204
.andExpect(status().isBadRequest())      // 400
.andExpect(status().isUnauthorized())    // 401
.andExpect(status().isForbidden())       // 403
.andExpect(status().isNotFound())        // 404
```

### JsonPath Assertions

```java
// Single field
.andExpect(jsonPath("$.name").value("Product 1"))
.andExpect(jsonPath("$.quantity").value(10))

// Array size
.andExpect(jsonPath("$", hasSize(2)))

// Array element
.andExpect(jsonPath("$[0].name").value("Product 1"))

// Field existence
.andExpect(jsonPath("$.id").exists())
```

---

## CRUD Test Examples

### GET — Product Not Found

```java
@Test
void testGetProductByIdNotFound() throws Exception {
    when(productRepository.findById(999L)).thenReturn(Optional.empty());

    mockMvc.perform(get("/api/products/999").with(user("testUser")))
        .andExpect(status().isNotFound());
}
```

### POST — Admin Creates Product

```java
@Test
void testValidProductCreation() throws Exception {
    Product product = new Product("New Product", 10, 100.0);
    product.setId(1L);
    when(productRepository.save(any(Product.class))).thenReturn(product);

    mockMvc.perform(post("/api/products")
        .contentType(APPLICATION_JSON)
        .content("{\"name\": \"New Product\", \"quantity\": 10, \"price\": 100.0}")
        .with(csrf())
        .with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("New Product"))
        .andExpect(jsonPath("$.quantity").value(10));
}
```

### PUT — Validation Failure

```java
@Test
void testInvalidUpdateNegativeQuantity() throws Exception {
    mockMvc.perform(put("/api/products/1")
        .contentType(APPLICATION_JSON)
        .content("{\"quantity\": -1}")
        .with(csrf())
        .with(user("admin").roles("ADMIN")))
        .andExpect(status().isBadRequest());
}
```

### DELETE — User Forbidden

```java
@Test
void testDeleteProductDeniedForUser() throws Exception {
    mockMvc.perform(delete("/api/products/1")
        .with(csrf())
        .with(user("regularUser").roles("USER")))
        .andExpect(status().isForbidden());
}
```

### Parameterized — Multiple Roles

```java
@ParameterizedTest
@CsvSource({"adminUser, ADMIN", "regularUser, USER"})
void testLowStockProductsWithRoles(String username, String role) throws Exception {
    when(productRepository.findByQuantityLessThan(5))
        .thenReturn(Arrays.asList(lowStockProduct));

    mockMvc.perform(get("/api/products/low-stock")
        .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].name").value("Low Stock Product 1"));
}
```

---

## Debug Helper

```java
// Print full request and response to console
mockMvc.perform(get("/api/products"))
    .andDo(print())
    .andExpect(status().isOk());
```

---

## Related Documentation

- **[Spring Slices](./spring-slices.md)** — `@WebMvcTest` setup details
- **[Security Tests](./security-tests.md)** — Role and CSRF patterns
- **[Test Data & Fixtures](./test-data-fixtures.md)** — Mock object setup
- **[Troubleshooting](./troubleshooting.md)** — Common MockMvc errors

---

**Last Updated**: June 2026
**Status**: Current

[Back to Testing Architecture Index](testing-architecture.md)
