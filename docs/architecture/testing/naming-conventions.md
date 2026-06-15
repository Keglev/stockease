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
| `HealthControllerTest` | `HealthController` | Unit — DB liveness probe branches |
| `ProductCreateControllerTest` | `ProductController` | Slice — POST /api/products |
| `ProductFetchControllerTest` | `ProductController` | Slice — GET endpoints |
| `ProductUpdateControllerTest` | `ProductController` | Slice — PUT happy-path updates |
| `ProductInvalidUpdateControllerTest` | `ProductController` | Slice — PUT validation and error paths |
| `ProductDeleteControllerTest` | `ProductController` | Slice — DELETE endpoints |
| `ProductPaginationControllerTest` | `ProductController` | Slice — pagination |
| `GlobalExceptionHandlerTest` | `GlobalExceptionHandler` | Unit — all exception handler methods |
| `ProductTest` | `Product` | Unit — null-guard branches in updateTotalValue |
| `DataSeederTest` | `DataSeeder` | Unit — idempotency guards |
| `FlywayConfigurationTest` | `FlywayConfiguration` | Unit — disabled-flyway branch |
| `JwtUtilTest` | `JwtUtil` | Unit — token generation, validation, claim extraction |
| `JwtFilterTest` | `JwtFilter` | Unit — all Bearer token filter branch paths |
| `CustomUserDetailsServiceTest` | `CustomUserDetailsService` | Unit — user lookup and not-found behavior |
| `CustomAuthenticationEntryPointTest` | `CustomAuthenticationEntryPoint` | Unit — 401 JSON error response |

---

## Test Method Naming

**Pattern**: `{methodName}_{stateUnderTest}_{expectedBehavior}`

All three segments are required. No `test` prefix.

```java
void login_withValidUserCredentials_returns200() { }
void login_withBadCredentials_returns401() { }
void createProduct_asUserRole_returns403() { }
void updateQuantity_withMissingField_returns400() { }
void deleteProduct_asAdmin_returns200() { }
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

## Inline Comments

AAA (Arrange / Act / Assert) section markers are optional and only used when the test is long enough that the sections are not immediately visible. Short tests (under 10 lines) need no markers.

Inline comments are allowed only for non-obvious setup — for example, explaining why a specific mock value was chosen, or why a particular edge case matters.

```java
@Test
void login_withNonExistentUsername_returns401() {
    when(userRepository.findByUsername("wronguser")).thenReturn(Optional.empty());
    // auth passes (mocked) but the repo has no record — covers a deleted or externally-removed account
    when(authenticationManager.authenticate(any())).thenReturn(null);

    ResponseEntity<ApiResponse<String>> response = authController.login(buildLoginRequest("wronguser", "password"));

    assertThat(response.getStatusCode().value()).isEqualTo(401);
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
