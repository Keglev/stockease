# Test Naming Conventions

**Purpose**: Establish consistent naming patterns for test classes and methods.

---

## Test Class Naming

**Pattern**: `{ClassName}Test.java`

Rules:
- Always end with `Test` (singular)
- Match the class under test in CamelCase
- One test class per production class
- Same package structure as production code

| Test Class | Production Class | Scope |
|------------|-----------------|-------|
| `AuthControllerTest` | `AuthController` | Unit — login logic |
| `ProductCreateControllerTest` | `ProductController` | Slice — POST /api/products |
| `ProductFetchControllerTest` | `ProductController` | Slice — GET endpoints |
| `ProductUpdateControllerTest` | `ProductController` | Slice — PUT endpoints |
| `ProductDeleteControllerTest` | `ProductController` | Slice — DELETE endpoints |
| `ProductPaginationControllerTest` | `ProductController` | Slice — pagination |

---

## Test Method Naming

**Pattern**: `{action}_{expectedBehavior}_{givenCondition}`

Shorter form when condition is obvious: `{action}_{scenario}`

### Variants

**Full descriptive** (recommended for complex scenarios):
```java
void testLoginSuccess_WhenValidCredentialsProvided() { }
void testProductCreation_Denied_WhenUserRoleAttempts() { }
```

**Concise** (acceptable when condition is clear from context):
```java
void testLoginSuccess() { }
void testProductCreationDenied() { }
```

**BDD-style** (use only if adopting a BDD framework):
```java
void should_LoginSuccessfully_WhenValidCredentialsProvided() { }
```

---

## Test Data Naming

**Pattern**: `{semantic}_{characteristic}`

```java
// Good
User mockUser = new User(1L, "testuser", "password", "ROLE_USER");
String jwtToken = "mockToken";
int lowStockThreshold = 5;

// Bad
User u = new User(1L, "x", "y", "ROLE_X");
String t = "abc";
int q = 5;
```

| Characteristic | Example |
|----------------|---------|
| `mock` | `mockUser`, `mockToken` |
| `valid` | `validProduct`, `validPassword` |
| `invalid` | `invalidQuantity = -1` |
| `empty` | `emptyProductList` |
| `expected` | `expectedStatus` |

---

## Given-When-Then Structure

Every test method must follow Given-When-Then either as inline comments or JavaDoc.

```java
/**
 * Given: A user with valid credentials exists
 * When: Login request is submitted
 * Then: JWT token is returned with success status
 */
@Test
void testLoginSuccess() {
    // Given
    when(jwtUtil.generateToken(username, role)).thenReturn(token);

    // When
    ResponseEntity<ApiResponse<String>> response = authController.login(loginRequest);

    // Then
    assertThat(response.getBody().isSuccess()).isTrue();
    assertThat(response.getBody().getData()).isEqualTo(token);
}
```

---

## Anti-Patterns

**Generic names** — `testMethod1()`, `test()`, `checkController()` give no information about intent.

**Ambiguous names** — `testUserLogin()` does not say whether the test expects success or failure.

**Mixed concerns** — one test method that logs in and also creates a product tests two behaviors; split it.

**Magic numbers** — `findByQuantityLessThan(5)` should use a named constant `LOW_STOCK_THRESHOLD = 5`.

---

## New Test Checklist

- [ ] Class name ends with `Test`
- [ ] Method name describes action + outcome
- [ ] Failure cases include `Denied`, `Invalid`, or `Failure` in the name
- [ ] Given-When-Then structure present
- [ ] Variable names are descriptive
- [ ] `@BeforeEach` resets mocks and state
- [ ] Parameterized variants use `@ParameterizedTest` with `@CsvSource`

---

## Related Documentation

- **[Coverage Matrix](./matrix.md)** — Full test method inventory
- **[Testing Strategy](./strategy.md)** — Philosophy behind these conventions
- **[Controller Integration Tests](./controller-integration.md)** — MockMvc naming examples

---

**Last Updated**: June 2026
**Status**: Current

[Back to Testing Architecture Index](testing-architecture.md)
