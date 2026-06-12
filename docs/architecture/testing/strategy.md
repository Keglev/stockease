# Testing Strategy

**Purpose**: Define the testing goals, philosophy, and scope for the StockEase backend.

---

## Testing Goals

| Goal | Metric |
|------|--------|
| **Correctness** — APIs return correct data and business logic works | 100% pass rate on PR merge |
| **Safety** — Catch regressions before production | Line coverage ≥ 70%, branch ≥ 60% |
| **Maintainability** — Tests are easy to read and modify | Clear naming, shared TestConfig |
| **Speed** — Fast feedback during development | Unit tests < 5s, full suite < 30s |
| **Authorization** — Role-based access is enforced | ADMIN vs USER tested on all endpoints |

---

## Testing Philosophy

### Test Behavior, Not Implementation
Test that `POST /api/products` returns the correct product — not that a mock was called N times.
Prefer `assertThat()` (AssertJ) over `verify()` (Mockito) where possible.

### Test in Isolation
Each test is independent. Use `@BeforeEach` to reset mocks and state. Tests can run in any order.

```java
@BeforeEach
void resetMocks() {
    Mockito.reset(productRepository, jwtUtil);
    Mockito.when(jwtUtil.validateToken(Mockito.anyString())).thenReturn(true);
}
```

### Use Appropriate Test Levels
- Unit tests for business logic
- Slice tests (`@WebMvcTest`) for controller endpoints
- Integration tests for application bootstrap
- E2E tests are out of scope for this backend

### Mock External Dependencies
Mock repositories and `JwtUtil` to avoid database and cryptographic operations in unit and slice tests.

### Use Parameterized Tests for Role Variants
One method covers multiple roles — reduces duplication and makes the authorization matrix explicit.

```java
@ParameterizedTest
@CsvSource({"adminUser, ADMIN", "regularUser, USER"})
void testLowStockProductsWithRoles(String username, String role) { }
```

---

## Scope

### In Scope
- REST endpoints: `AuthController`, `ProductController`
- Authentication and JWT token flow
- Role-based access control (ADMIN vs USER)
- Request validation (quantity, price, required fields)
- Application bootstrap (Spring context loads)

### Out of Scope

| Area | Reason |
|------|--------|
| E2E / UI tests | Frontend is a separate repository |
| Performance / load tests | Not required for current stage |
| Repository layer tests | Repositories are mocked; queries are simple |
| External service integration | No external APIs in current codebase |
| Security vulnerability scanning | Handled by OWASP Dependency Check in CI |

---

## Related Documentation

- **[Test Pyramid](./pyramid.md)** — Test level distribution
- **[Coverage Matrix](./matrix.md)** — What is tested by layer and feature
- **[Coverage & Quality](./coverage-and-quality.md)** — JaCoCo thresholds and reports
- **[CI Pipeline Tests](./ci-pipeline-tests.md)** — Pipeline gates
- **[Troubleshooting](./troubleshooting.md)** — Common issues and fixes

---

**Last Updated**: June 2026
**Status**: Current

[Back to Testing Architecture Index](testing-architecture.md)