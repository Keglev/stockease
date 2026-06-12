# Troubleshooting

**Purpose**: Common test failures, CI errors, and their fixes.

---

## Spring Slice Errors

### No qualifying bean of type 'JwtUtil'

```
Error: No qualifying bean of type 'JwtUtil' found
Cause: @WebMvcTest does not load @Service or @Component beans
Fix:   Add @Import(TestConfig.class) to the test class
```

```java
@WebMvcTest(ProductController.class)
@Import(TestConfig.class)  // add this
class ProductControllerTest { }
```

---

### 403 on POST when Expecting 200

```
Error: Expected 200, got 403
Cause: CSRF token missing
Fix:   Add .with(csrf()) to POST, PUT, DELETE requests
```

```java
mockMvc.perform(post("/api/products")
    .with(csrf())                          // add this
    .with(user("admin").roles("ADMIN")))
    .andExpect(status().isOk());
```

---

### 401 on Request when Expecting 403

```
Error: Expected 403 Forbidden, got 401 Unauthorized
Cause: .with(user(...)) is missing — request is anonymous
Fix:   Add user context to the request
```

```java
mockMvc.perform(post("/api/products")
    .with(csrf())
    .with(user("regularUser").roles("USER")))  // add this
    .andExpect(status().isForbidden());
```

---

### @MockBean vs @MockitoBean

```
Error: @MockBean not found or deprecated warning
Cause: Spring Boot 3.4+ replaced @MockBean with @MockitoBean
Fix:   Use @MockitoBean in Spring Boot 3.4+
```

```java
// Spring Boot < 3.4
@MockBean
private ProductRepository productRepository;

// Spring Boot 3.4+
@MockitoBean
private ProductRepository productRepository;
```

---

## CI Failures

### Reproducing a CI Failure Locally

```bash
cd backend
mvn clean test
```

If it passes locally but fails in CI, check:
- JDK version mismatch (CI uses JDK 17)
- Missing environment variables in the workflow file
- Timing or state issues between tests (flaky test)

---

### Coverage Gate Failure

```
Error: Coverage below minimum threshold (e.g. 65% < 70%)
Fix options:
  1. Add tests for uncovered lines (preferred)
  2. Exclude generated code (entities, config) from threshold
```

To find uncovered lines after running `mvn clean test jacoco:report`:
```
open backend/target/site/jacoco/index.html
```
Red lines = not executed. Yellow = branch not fully covered.

---

### Flaky Tests

Symptoms: test passes locally and sometimes in CI, fails intermittently.

Causes and fixes:

| Cause | Fix |
|-------|-----|
| Shared mutable state between tests | Use `@BeforeEach` to reset mocks |
| Timing assumptions (`Thread.sleep`) | Remove sleeps; use deterministic mocks |
| Test order dependency | Ensure each test sets up its own data |
| Inconsistent mock behavior | Reset all mocks in `@BeforeEach` |

```java
@BeforeEach
void resetMocks() {
    Mockito.reset(productRepository, jwtUtil);
    when(jwtUtil.validateToken(anyString())).thenReturn(true);
}
```

---

### Viewing CI Artifacts

1. Go to GitHub → Actions → select the failed run
2. Scroll to the Artifacts section
3. Download `test-reports.zip` for Surefire output
4. Download `jacoco-report.zip` for coverage HTML

---

## Related Documentation

- **[Spring Slices](./spring-slices.md)** — Slice annotation reference
- **[CI Pipeline Tests](./ci-pipeline-tests.md)** — Pipeline gates and workflow config
- **[Coverage & Quality](./coverage-and-quality.md)** — JaCoCo thresholds

---

**Last Updated**: June 2026
**Status**: Current

[Back to Testing Architecture Index](testing-architecture.md)
