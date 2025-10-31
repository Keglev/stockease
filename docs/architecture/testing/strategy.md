# Testing Strategy

**Overview**: This document describes the testing philosophy, goals, scope, and approach for the StockEase backend.

---

## Table of Contents

1. [Testing Goals](#testing-goals)
2. [Testing Philosophy](#testing-philosophy)
3. [Scope: In Scope](#scope-in-scope)
4. [Scope: Out of Scope](#scope-out-of-scope)
5. [Test Levels](#test-levels)
6. [Success Criteria](#success-criteria)
7. [Risk Mitigation](#risk-mitigation)
8. [Related Documentation](#related-documentation)

---

## Testing Goals

### Primary Goals

| Goal | Rationale | Metric |
|------|-----------|--------|
| **Correctness** | Ensure APIs return correct data and business logic works | Pass rate 100% on PR merge |
| **Safety** | Catch regressions early before production | Coverage ≥ 70% line, ≥ 60% branch |
| **Maintainability** | Make tests easy to understand and modify | Clear naming, shared test configs |
| **Speed** | Enable fast feedback loops during development | Unit tests < 5 sec, all tests < 30 sec |

### Secondary Goals

| Goal | Why | Current Status |
|------|-----|---|
| **Authorization** | Verify role-based access works (ADMIN vs USER) | ✅ Implemented in controller tests |
| **Data Integrity** | Ensure data isn't corrupted during CRUD operations | ✅ Mocked repository validation |
| **API Contract** | Prevent breaking changes to REST endpoints | 🔶 Manual (OpenAPI spec ready) |
| **Performance** | Detect performance regressions | ❌ Deferred (no load tests yet) |

---

## Testing Philosophy

### Principle 1: Test Behavior, Not Implementation
- **Do**: Test that `POST /api/products` returns a product with the correct name
- **Don't**: Test that the mock was called exactly 3 times
- **Tool**: Use `assertThat()` (AssertJ) over `verify()` (Mockito) when possible

### Principle 2: Test in Isolation
- Each test should be independent and not depend on other tests
- Use `@BeforeEach` to reset mocks and state
- Tests can run in any order

**Example** (from `ProductControllerTest.java`):
```java
@BeforeEach
void resetMocks() {
    Mockito.reset(productRepository, jwtUtil);
    Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
}
```

### Principle 3: Use Appropriate Test Levels
- **Unit tests** for business logic (services, utils)
- **Slice tests** for controller endpoints (fast, focused)
- **Integration tests** for full workflows (slower, rare)
- **Avoid**: End-to-end UI tests (out of scope for this backend)

### Principle 4: Mock External Dependencies
- Mock database repositories to test controller logic in isolation
- Mock `JwtUtil` to avoid cryptographic operations
- Keep mocks predictable and deterministic

**Example** (from `AuthControllerTest.java`):
```java
@Mock
private JwtUtil jwtUtil;

@Test
void testLoginSuccess() {
    when(jwtUtil.generateToken(username, role)).thenReturn(token);
    // Test doesn't depend on actual JWT generation
}
```

### Principle 5: Use Parameterized Tests for Multiple Scenarios
- One test method can cover multiple input combinations
- Reduces code duplication
- Makes it clear what scenarios are tested

**Example** (from `ProductControllerTest.java`):
```java
@ParameterizedTest
@CsvSource({
    "adminUser, ADMIN",
    "regularUser, USER"
})
void testLowStockProductsWithRoles(String username, String role) { }
```

---

## Scope: In Scope

### ✅ What We Test

#### 1. REST API Endpoints
- **Controllers**: `AuthController`, `ProductController`
- **Methods**: POST (create), GET (read), PUT (update), DELETE
- **Coverage**: Happy path, error cases, authorization checks
- **Test Classes**: `ProductCreateControllerTest`, `ProductFetchControllerTest`, etc.

```
POST /api/auth/login
├─ Success: Valid username/password → JWT token
├─ Failure: Invalid credentials → 401
└─ Failure: User not found → 401

GET /api/products
├─ Success: Admin/User → Product list
├─ Authorization: Anonymous → 401
└─ Pagination: Skip/limit parameters

POST /api/products
├─ Success: Admin only → Created product
├─ Failure: Non-admin → 403
└─ Failure: Invalid data → 400

PUT /api/products/{id}
├─ Success: Admin only → Updated product
├─ Failure: Non-admin → 403
└─ Failure: Invalid quantity → Validation error

DELETE /api/products/{id}
├─ Success: Admin only → 204 No Content
└─ Failure: Non-admin → 403
```

#### 2. Authentication & Authorization
- JWT token generation and validation
- Role-based access control (ADMIN vs USER)
- Spring Security integration

**Test Classes**: `AuthControllerTest.java`, `ProductCreateControllerTest.java`

#### 3. Request/Response Validation
- Input validation (e.g., product name, quantity)
- HTTP status codes (200, 201, 400, 401, 403, 404)
- Response JSON structure

#### 4. Business Logic
- Product CRUD operations
- Inventory calculations
- Role-based permissions

#### 5. Application Bootstrap
- Spring context loads successfully
- All beans are wired correctly
- Configuration properties are applied

**Test Class**: `StockEaseApplicationTests.java`

---

## Scope: Out of Scope

### ❌ What We Don't Test (Yet)

#### 1. End-to-End UI Tests
- **Why excluded**: Frontend is separate (React/Vite), requires different test stack
- **Future**: Could be added later with Playwright or Cypress

#### 2. Performance/Load Tests
- **Why excluded**: Not required for MVP
- **Future**: Consider JMH or k6 if performance becomes critical

#### 3. Database Layer Tests
- **Why excluded**: Using H2 in-memory database with mocked repositories
- **Note**: Repository logic is tested indirectly through controller tests
- **Future**: Could add @DataJpaTest for specific query methods

#### 4. Integration with External Services
- **Why excluded**: No external API calls in current codebase
- **Note**: If added (e.g., payment gateway), would use `@MockServer` or similar

#### 5. Security Vulnerability Scanning
- **Why excluded**: Handled by OWASP Dependency Check in CI
- **Note**: Tests focus on functional security, not vulnerability discovery

#### 6. Stress/Chaos Tests
- **Why excluded**: Not required for MVP
- **Future**: If high availability is critical, add circuit breaker tests

---

## Test Levels

### Level 1: Unit Tests (70%)

**Definition**: Test a single class or method in isolation with all dependencies mocked.

**Examples**:
- Controller action: `AuthControllerTest.testLoginSuccess()`
- Service method: Mock `AuthenticationManager`, test login logic

**Framework**: JUnit 5, Mockito  
**Execution**: < 1 sec per test  
**Files**: `backend/src/test/java/com/stocks/stockease/controller/`

### Level 2: Slice Tests (25%)

**Definition**: Test a horizontal slice of the application (e.g., web layer) without the full context.

**Pattern**: `@WebMvcTest` — loads only controllers + security, not services/repositories

**Examples**:
- `ProductControllerTest` — HTTP layer with MockMvc, repository mocked
- `ProductCreateControllerTest` — POST endpoint with authorization checks

**Framework**: Spring Boot Test, MockMvc, Mockito  
**Execution**: 1-2 sec per test  
**Files**: Most classes in `backend/src/test/java/com/stocks/stockease/controller/`

```java
@WebMvcTest(ProductController.class)
public class ProductFetchControllerTest {
    @Autowired private MockMvc mockMvc;
    @MockitoBean private ProductRepository productRepository; // Mocked!
    
    @Test
    void testGetProducts() throws Exception {
        mockMvc.perform(get("/api/products")
            .with(SecurityMockMvcRequestPostProcessors.user("testUser")))
        .andExpect(status().isOk());
    }
}
```

### Level 3: Integration Tests (5%)

**Definition**: Test multiple components working together (e.g., controller + service + repository).

**Pattern**: `@SpringBootTest` — loads full application context

**Examples**:
- `StockEaseApplicationTests.contextLoads()` — verify all beans wire correctly

**Framework**: Spring Boot Test  
**Execution**: 3-5 sec per test  
**Files**: `backend/src/test/java/com/stocks/stockease/`

```java
@SpringBootTest
@ActiveProfiles("test")
class StockEaseApplicationTests {
    @Test
    void contextLoads() {
        // Spring has successfully loaded all beans
    }
}
```

### Level 4: System/E2E Tests (Future)

**Not implemented yet** — Would require:
- Full stack: frontend + backend + database
- Browser automation (Playwright, Cypress)
- Test data setup across layers
- ~30 seconds per test

---

## Success Criteria

### Build-Time Criteria (Automated)
- ✅ All 65+ tests pass: `mvn clean test`
- ✅ No compilation errors
- ✅ Line coverage ≥ 70%
- ✅ Branch coverage ≥ 60%

### Code Review Criteria (Manual)
- ✅ New tests for new functionality
- ✅ Clear, descriptive test names
- ✅ No test interdependencies
- ✅ Mocks are appropriate (not over-mocking)

### Performance Criteria
- ✅ All tests complete in < 30 seconds
- ✅ Each unit test completes in < 1 second
- ✅ Controller slice tests complete in < 2 seconds

### Maintenance Criteria
- ✅ Tests use shared `TestConfig` to avoid duplication
- ✅ Test data is consistent across test classes
- ✅ Mocks are reset in `@BeforeEach`

---

## Risk Mitigation

### Risk 1: Broken Tests Block Merges
- **Mitigation**: Run tests locally before push (`mvn clean test`)
- **Fallback**: CI blocks merge if tests fail (GitHub Actions gate)

### Risk 2: Tests Become Obsolete
- **Mitigation**: Update tests when requirements change
- **Process**: Include test updates in code review checklist

### Risk 3: Coverage Gaps Hide Bugs
- **Mitigation**: Target 70%+ coverage, focus on critical paths
- **Tools**: JaCoCo report highlights uncovered code

### Risk 4: Flaky Tests (Intermittent Failures)
- **Mitigation**: Use `@BeforeEach` to reset state, avoid `sleep()`
- **Monitor**: Track flaky tests in CI logs

### Risk 5: Test Data Inconsistency
- **Mitigation**: Use `TestConfig.java` for shared mock setup
- **Benefit**: All tests see consistent JWT, SecurityContext

---

## Current Test Coverage

### By Layer
| Layer | Tests | Method |
|-------|-------|--------|
| Controller | 8 classes | @WebMvcTest |
| Service | 0 (mocked) | Not tested in isolation |
| Repository | 0 (mocked) | Not tested in isolation |
| Security | 2 classes | JWT validation in controller tests |
| Config | 0 (bootstrapped) | Tested via contextLoads() |

### By Feature
| Feature | Tests | Status |
|---------|-------|--------|
| Authentication | 2 | ✅ AuthControllerTest |
| Product CRUD | 7 | ✅ ProductControllerTest, ProductCreateControllerTest, etc. |
| Authorization | 7 | ✅ Role checks in all controller tests |
| Application Bootstrap | 1 | ✅ StockEaseApplicationTests |

---

## Testing Best Practices Applied

### ✅ Currently Doing Well
1. **Clear test names**: `testValidProductCreation`, `testLoginSuccess`
2. **Mocking external deps**: JwtUtil, AuthenticationManager are mocked
3. **Using Spring slices**: @WebMvcTest keeps tests fast
4. **Parameterized tests**: @ParameterizedTest with @CsvSource
5. **Isolated test state**: @BeforeEach resets mocks
6. **Shared test config**: TestConfig.java for common beans

### 🔶 Could Improve
1. **Service layer tests**: Add unit tests for business logic (future)
2. **Test data builders**: Create reusable object builders (future)
3. **API contract tests**: Validate OpenAPI schema (future)
4. **Performance baselines**: Add timing assertions (future)

---

## Related Documentation

### Testing Topics
- **[Test Pyramid](./pyramid.md)** — Unit/slice/integration breakdown
- **[Coverage Matrix](./matrix.md)** — What's tested by layer and feature
- **[Naming Conventions](./naming-conventions.md)** — Test method naming patterns
- **[Spring Slices](./spring-slices.md)** — @WebMvcTest and slice test patterns

### Implementation Details
- **[Security Tests](./security-tests.md)** — How we test JWT and roles
- **[Test Data & Fixtures](./test-data-fixtures.md)** — Mock setup and TestConfig
- **[Controller Integration Tests](./controller-integration.md)** — MockMvc patterns

### Quality & Metrics
- **[Coverage & Quality](./coverage-and-quality.md)** — JaCoCo thresholds, reports
- **[CI Pipeline Tests](./ci-pipeline-tests.md)** — What runs in GitHub Actions

### Main Architecture
- **[Testing Architecture](../testing-architecture.md)** — Entry point for all test docs
- **[Backend Architecture](../backend.md)** — System components being tested
- **[Security Architecture](../security.md)** — Authentication & authorization

---

**Last Updated**: October 31, 2025  
**Version**: 1.0  
**Status**: ✅ Reflects current test implementation

[Back to Testing Index](../testing-architecture.md)
