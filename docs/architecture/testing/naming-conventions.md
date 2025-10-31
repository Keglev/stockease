# Test Naming Conventions

**Purpose**: Establish clear, consistent naming patterns for test classes and methods to improve readability and maintainability.

---

## Table of Contents

1. [Test Class Naming](#test-class-naming)
2. [Test Method Naming](#test-method-naming)
3. [Test Data Naming](#test-data-naming)
4. [Given-When-Then Pattern](#given-when-then-pattern)
5. [Examples from StockEase](#examples-from-stockease)
6. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
7. [Related Documentation](#related-documentation)

---

## Test Class Naming

### Pattern
```
{ClassName}Test.java
```

### Rules
1. **Suffix**: Always end with `Test` (singular)
2. **Location**: Same package structure as production code
3. **Naming Style**: CamelCase, matching the class being tested
4. **One class per test file**: Don't combine multiple test classes

### Examples from StockEase

| Test Class | Production Class | Purpose |
|----------|---|---|
| `AuthControllerTest.java` | `AuthController` | Unit tests for auth logic |
| `ProductControllerTest.java` | `ProductController` | Slice tests for general product endpoints |
| `ProductCreateControllerTest.java` | `ProductController` | Slice tests for POST /api/products |
| `ProductFetchControllerTest.java` | `ProductController` | Slice tests for GET endpoints |
| `ProductUpdateControllerTest.java` | `ProductController` | Slice tests for PUT endpoints |
| `ProductDeleteControllerTest.java` | `ProductController` | Slice tests for DELETE endpoints |
| `ProductPaginationControllerTest.java` | `ProductController` | Slice tests for pagination |
| `StockEaseApplicationTests.java` | (N/A) | Application bootstrap test |

### Rationale
- **Clear ownership**: A test class tests a specific production class
- **Easy discovery**: Maven Surefire finds `*Test.java` by default
- **Familiar convention**: Follows Java/JUnit standards

---

## Test Method Naming

### General Pattern
```
{action}_{expectedBehavior}_{givenCondition}
```

OR (shorter form)
```
{action}_{scenario}
```

### Detailed Rules

| Component | Guidelines | Example |
|-----------|-----------|---------|
| **Action** | Verb starting with `test` | `testLogin`, `testCreate`, `testFetch` |
| **Expected Behavior** | What should happen | `Success`, `Denied`, `ReturnsEmpty`, `ValidatesInput` |
| **Given Condition** | When/under what conditions | `WithValidCredentials`, `WithAdminRole`, `WithInvalidData` |

### Pattern Variants

#### Variant A: Full Descriptive (Recommended)
```java
void testLoginSuccess_WhenValidCredentialsProvided() { }
void testProductCreation_Denied_WhenUserRoleAttempts() { }
void testGetLowStockProducts_ReturnsEmpty_WhenNoLowStock() { }
```

**Pros**: Crystal clear intention  
**Cons**: Longer names  
**Use when**: Testing complex scenarios with specific conditions

#### Variant B: Concise (Also Acceptable)
```java
void testLoginSuccess() { }
void testProductCreationDenied() { }
void testLowStockProductsEmpty() { }
```

**Pros**: Shorter, faster to type  
**Cons**: Condition not in name  
**Use when**: Condition is obvious or commented

#### Variant C: BDD-Style (Emerging)
```java
void should_LoginSuccessfully_WhenValidCredentialsProvided() { }
void should_DenyProductCreation_WhenUserRoleAttempts() { }
void should_ReturnEmpty_WhenNoLowStockProducts() { }
```

**Pros**: Explicitly states requirement as behavior  
**Cons**: Longer, different style  
**Use when**: Working with BDD frameworks (not currently used)

---

## Test Data Naming

### Naming Convention
```
{semantic}_{characteristic}
```

### Examples

```java
@Test
void testLoginSuccess() {
    // ✅ Good: Descriptive semantic + characteristic
    String username = "testuser";
    String password = "testpassword";
    String role = "ROLE_USER";
    String token = "mockToken";
    
    // ✅ Good: Object names indicate what they represent
    User mockUser = new User(1L, username, password, role);
    LoginRequest loginRequest = new LoginRequest(username, password);
    
    // ❌ Bad: Generic names
    String u = "testuser";
    String p = "testpassword";
    Object obj = new Object();
}
```

### Test Data Characteristics

| Characteristic | Example | When to Use |
|---|---|---|
| **mock** | `mockUser`, `mockToken` | Data created from mocks |
| **valid** | `validProduct`, `validPassword` | Data that should work |
| **invalid** | `invalidQuantity = -1` | Data that should fail |
| **empty** | `emptyProductList` | Boundary condition |
| **expected** | `expectedStatus`, `expectedResponse` | Assertion target |
| **actual** | `actualResponse` | What we got back |

---

## Given-When-Then Pattern

### Philosophy
Structure test methods using the **Given-When-Then (GWT)** pattern as JavaDoc or comments:

```
Given: [preconditions/setup]
When: [action taken]
Then: [expected outcome]
```

### Example 1: AuthControllerTest
```java
/**
 * Given: A user with valid credentials in the database
 * When: Login request is made with correct username and password
 * Then: Login succeeds and a JWT token is returned
 */
@Test
void testLoginSuccess() {
    // Given
    String username = "testuser";
    String password = "testpassword";
    String role = "ROLE_USER";
    String token = "mockToken";
    User mockUser = new User(1L, username, password, role);
    
    when(userRepository.findByUsername(username)).thenReturn(Optional.of(mockUser));
    when(authenticationManager.authenticate(any())).thenReturn(null);
    when(jwtUtil.generateToken(username, role)).thenReturn(token);
    
    // When
    LoginRequest loginRequest = new LoginRequest(username, password);
    ResponseEntity<ApiResponse<String>> responseEntity = authController.login(loginRequest);
    
    // Then
    assertThat(responseEntity).isNotNull();
    ApiResponse<String> response = responseEntity.getBody();
    assertThat(response.isSuccess()).isTrue();
    assertThat(response.getData()).isEqualTo(token);
}
```

### Example 2: ProductCreateControllerTest
```java
/**
 * Given: An admin user is authenticated
 * When: A POST request is made to create a product with valid data
 * Then: Product is created and returned with 200 OK status
 */
@Test
void testValidProductCreation() throws Exception {
    // Given
    Product product1 = new Product("Product 1", 10, 100.0);
    product1.setId(1L);
    product1.setTotalValue(1000.0);
    when(productRepository.save(any(Product.class))).thenReturn(product1);
    
    // When
    mockMvc.perform(post("/api/products")
        .contentType(APPLICATION_JSON)
        .content("{\"name\": \"Product 1\", \"quantity\": 10, \"price\": 100.0}")
        .with(csrf())
        .with(user("adminUser").roles("ADMIN")))
    
    // Then
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.name").value("Product 1"))
    .andExpect(jsonPath("$.quantity").value(10));
}
```

### Example 3: Parameterized Test
```java
/**
 * Given: A product endpoint and various user roles
 * When: Different roles attempt to fetch low-stock products
 * Then: Both admin and user roles get success response
 */
@ParameterizedTest
@CsvSource({
    "adminUser, ADMIN",
    "regularUser, USER"
})
void testLowStockProductsWithRoles(String username, String role) throws Exception {
    // Given
    Product product1 = new Product("Low Stock Product 1", 3, 50.0);
    product1.setId(1L);
    when(productRepository.findByQuantityLessThan(5))
        .thenReturn(Arrays.asList(product1));
    
    // When
    mockMvc.perform(get("/api/products/low-stock")
        .with(user(username).roles(role)))
    
    // Then
    .andExpect(status().isOk())
    .andExpect(jsonPath("$[0].name").value("Low Stock Product 1"));
}
```

### GWT in JavaDoc Format
```java
/**
 * Tests successful login for a regular user.
 * 
 * Given: A user with valid credentials exists in the repository
 * When: The login endpoint receives a valid login request
 * Then: The response contains a JWT token and success status
 * 
 * @see AuthController#login(LoginRequest)
 * @see JwtUtil#generateToken(String, String)
 */
@Test
void testLoginSuccess() {
    // ...
}
```

---

## Examples from StockEase

### AuthControllerTest Methods
```java
// ✅ Descriptive, follows Given-When-Then
void testLoginSuccess() { }
void testLoginFailureWithInvalidCredentials() { }
void testLoginFailureWithUserNotFound() { }
void testAdminLoginSuccess() { }
```

### ProductControllerTest Methods
```java
// ✅ Parameterized with role variants
void testLowStockProductsWithRoles(String username, String role) { }
void testLowStockProductsEmptyWithRoles(String username, String role) { }

// ✅ Clear scenario naming
void testGetProductByIdSuccess() { }
void testGetProductByIdNotFound() { }
```

### ProductCreateControllerTest Methods
```java
// ✅ Clear CRUD operation + outcome
void testValidProductCreation() { }
void testProductCreationDeniedForUser() { }
void testProductCreationWithoutAuth() { }

// ✅ Parameterized authorization checks
void testProductCreationDeniedForUser(String username, String role) { }
```

### ProductUpdateControllerTest Methods
```java
// ✅ Specific update scenarios
void testValidProductUpdate() { }
void testProductUpdateQuantity() { }
void testProductUpdateDeniedForUser() { }
void testInvalidUpdateNegativeQuantity() { }
```

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Generic Names
```java
// BAD
void testMethod1() { }
void test() { }
void testMethod() { }

// GOOD
void testLoginSuccess() { }
void testProductCreationDenied() { }
```

### ❌ Anti-Pattern 2: Test Names That Don't Describe Behavior
```java
// BAD
void testUserLogin() { }  // Unclear: success or failure?
void testProduct() { }     // What about product?
void checkController() { } // Is it a test?

// GOOD
void testLoginSuccessWithValidCredentials() { }
void testProductCreationByAdmin() { }
void testControllerAuthorization() { }
```

### ❌ Anti-Pattern 3: Multiple Assertions Without Grouping
```java
// BAD - No Given-When-Then structure
@Test
void testLoginAndProduct() {
    login();
    assertThat(token).isNotNull();
    createProduct();
    assertThat(product).isNotNull();
    // Why are we mixing login and product in one test?
}

// GOOD - Focused test
@Test
void testLoginSuccess() {
    // Given, When, Then for login only
}
```

### ❌ Anti-Pattern 4: Unclear Test Data
```java
// BAD
User u = new User(1L, "x", "y", "ROLE_X");
String t = "abc123";
int q = 5;

// GOOD
User testUser = new User(1L, "testuser", "password", "ROLE_USER");
String jwtToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
int lowStockThreshold = 5;
```

### ❌ Anti-Pattern 5: Magic Numbers Without Context
```java
// BAD
when(productRepository.findByQuantityLessThan(5)).thenReturn(list);

// GOOD
int LOW_STOCK_THRESHOLD = 5;
when(productRepository.findByQuantityLessThan(LOW_STOCK_THRESHOLD))
    .thenReturn(list);
```

---

## Current Test Method Inventory

### By Naming Pattern

#### Pattern: `test{Action}{Outcome}`
- `testLoginSuccess` — Login succeeds
- `testGetProductsEmpty` — GET returns empty list
- `testValidProductCreation` — Valid product is created

#### Pattern: `test{Action}Denied` (Authorization)
- `testProductCreationDenied` — Non-admin blocked
- `testProductUpdateDeniedForUser` — User role blocked
- `testProductDeleteDeniedForUser` — User role blocked

#### Pattern: `test{Action}Invalid` (Validation)
- `testInvalidUpdateQuantity` — Negative quantity rejected
- `testInvalidUpdateNegativePrice` — Negative price rejected

#### Pattern: `test{Action}With{Variant}` (Parameterized)
- `testLowStockProductsWithRoles` — Multiple roles tested
- `testProductCreationDeniedForUser` — User/admin variants

---

## Checklist for New Tests

When writing a new test, ensure:

- [ ] **Class name** ends with `Test` (e.g., `ControllerTest`)
- [ ] **Method name** describes action + outcome (e.g., `testLoginSuccess`)
- [ ] **Method name** includes "Denied" or "Error" for failure cases
- [ ] **JavaDoc or Given-When-Then comment** explains the test
- [ ] **Setup is clear** with descriptive variable names
- [ ] **Assertions check the right thing** (behavior, not implementation)
- [ ] **@BeforeEach** resets mocks and state
- [ ] **Parameterized tests** use `@ParameterizedTest` with `@CsvSource` for variants

---

## Related Documentation

### Testing Fundamentals
- **[Testing Strategy](./strategy.md)** — Goals, philosophy, scope
- **[Test Pyramid](./pyramid.md)** — Unit/slice/integration breakdown
- **[Spring Slices](./spring-slices.md)** — Test class patterns

### Implementation Examples
- **[Controller Integration Tests](./controller-integration.md)** — MockMvc patterns
- **[Security Tests](./security-tests.md)** — Authorization test patterns
- **[Test Data & Fixtures](./test-data-fixtures.md)** — Mock data setup

### Main Documentation
- **[Testing Architecture](../testing-architecture.md)** — Entry point
- **[Backend Architecture](../backend.md)** — Code being tested

---

**Last Updated**: October 31, 2025  
**Version**: 1.0  
**Status**: ✅ Based on actual StockEase test code

[Back to Testing Index](../testing-architecture.md)
