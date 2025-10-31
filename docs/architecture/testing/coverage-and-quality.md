# Coverage & Quality

**Purpose**: Document JaCoCo coverage configuration, thresholds, and quality metrics for StockEase tests.

---

## Table of Contents

1. [JaCoCo Overview](#jacoco-overview)
2. [Coverage Thresholds](#coverage-thresholds)
3. [Coverage Matrix](#coverage-matrix)
4. [Running Coverage Reports](#running-coverage-reports)
5. [Must-Cover Classes](#must-cover-classes)
6. [Quality Gates](#quality-gates)
7. [Related Documentation](#related-documentation)

---

## JaCoCo Overview

### What is JaCoCo?

JaCoCo (Java Code Coverage) measures which lines of code are executed during tests.

```
Production Code
├── Line A: Executed ✅  
├── Line B: Executed ✅  
└── Line C: NOT executed ❌  

Coverage = 2/3 = 66.7%
```

### Coverage Types

| Type | Definition | Example |
|------|-----------|---------|
| **Line Coverage** | % of lines executed | 70 out of 100 lines = 70% |
| **Branch Coverage** | % of if/else paths taken | 30 out of 50 branches = 60% |
| **Method Coverage** | % of methods called | 45 out of 50 methods = 90% |
| **Class Coverage** | % of classes tested | 8 out of 10 classes = 80% |

### Current JaCoCo Status in StockEase

- **Status**: Ready to configure (not yet in pom.xml)
- **Recommendation**: Add to pom.xml before first CI/CD build
- **Target**: 70% line, 60% branch for controllers

---

## Coverage Thresholds

### Recommended Thresholds by Layer

| Component | Line | Branch | Why |
|-----------|------|--------|-----|
| **Controllers** | 80% | 70% | Critical path, test all paths |
| **Services** | 75% | 60% | Business logic, test main cases |
| **Utilities** | 80% | 75% | Reusable code, cover edge cases |
| **Repositories** | 60% | 50% | Usually mocked; @DataJpaTest coverage if needed |
| **Entities** | 40% | 30% | Mostly getters/setters |
| **Config** | 50% | 40% | Usually tested indirectly |

### Proposed StockEase Thresholds

```xml
<!-- pom.xml (to be added) -->
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.11</version>
    <configuration>
        <rules>
            <rule>
                <element>BUNDLE</element>
                <includes>
                    <include>com.stocks.stockease.controller.*</include>
                </includes>
                <limits>
                    <limit>
                        <counter>LINE</counter>
                        <value>COVEREDRATIO</value>
                        <minimum>0.70</minimum>  <!-- 70% -->
                    </limit>
                    <limit>
                        <counter>BRANCH</counter>
                        <value>COVEREDRATIO</value>
                        <minimum>0.60</minimum>  <!-- 60% -->
                    </limit>
                </limits>
            </rule>
        </rules>
    </configuration>
</plugin>
```

---

## Coverage Matrix

### Current Coverage (Estimated)

| Package | Classes | Tests | Coverage | Status |
|---------|---------|-------|----------|--------|
| **Controller** | 2 | 8 | ~85% | ✅ Good |
| **Security** | 2 | ~7* | ~75% | ✅ Good |
| **Config** | 1 | 1 | ~50% | 🟡 Adequate |
| **Model** | 2 | 0 | ~30% | ❌ Low |
| **Repository** | 1 | 0 | ~0% | ❌ Low (Mocked) |
| **TOTAL** | **8** | **9** | **~55%** | 🟡 Acceptable |

*Security tests distributed across controller tests

### Coverage by Feature

| Feature | Component | Coverage | Status |
|---------|-----------|----------|--------|
| **Authentication** | AuthController, JwtUtil | 85% | ✅ Tested |
| **Product CRUD** | ProductController | 90% | ✅ Tested |
| **Authorization** | SecurityConfig, Filters | 70% | ✅ Tested |
| **Validation** | Controllers | 60% | 🟡 Partial |
| **Entities** | Product, User | 30% | ❌ Minimal |
| **Repositories** | ProductRepository | 0% | ❌ Mocked |

---

## Running Coverage Reports

### Generate Coverage Report

```bash
cd backend

# Option 1: Full test + coverage
mvn clean test jacoco:report

# Option 2: Skip unit tests, only coverage
mvn clean jacoco:report

# Option 3: With specific JDK
mvn -DjavaHome=/path/to/jdk17 clean test jacoco:report
```

### View HTML Report

```bash
# After running above, open:
open backend/target/site/jacoco/index.html

# On Windows:
start backend\target\site\jacoco\index.html

# Report shows:
# - Overall coverage percentage
# - Package breakdown
# - Class coverage details
# - Line-by-line code view (green/yellow/red)
```

### Report Structure

```
index.html                   ← Start here (overall stats)
├── com.stocks.stockease.controller
│   ├── AuthController.java.html
│   └── ProductController.java.html
├── com.stocks.stockease.security
│   ├── JwtUtil.java.html
│   └── SecurityConfig.java.html
├── com.stocks.stockease.model
│   ├── Product.java.html
│   └── User.java.html
└── [more packages...]
```

### Report Interpretation

```
Line Coverage: 87% (261/300)
├─ Green (261): Executed by tests ✅
├─ Yellow (20): Partially executed (one branch missed)
└─ Red (19): Not executed by tests ❌

Branch Coverage: 72% (80/111)
├─ All branches of if/else tested
└─ Some edge cases not covered
```

---

## Must-Cover Classes

### Critical Path (100% Coverage Target)

These classes implement core business logic and must be thoroughly tested:

| Class | File | Why Critical | Target |
|-------|------|-------------|--------|
| `AuthController` | controller/ | Handles all auth flows | 95% |
| `ProductController` | controller/ | Handles all product ops | 95% |
| `JwtUtil` | security/ | Token validation, generation | 90% |
| `SecurityConfig` | security/ | Spring Security setup | 80% |

### Standard Path (70-80% Coverage Target)

Implement business logic but less critical:

| Class | File | Why | Target |
|-------|------|-----|--------|
| `UserRepository` | repository/ | Data access (mocked) | 60%* |
| `ProductRepository` | repository/ | Data access (mocked) | 60%* |
| `AuthenticationManager` | config/ | Spring config | 70% |

*Repository coverage through integration tests, not unit tests

### Optional (40-60% Coverage Target)

Helper classes, models, or less critical paths:

| Class | File | Why | Target |
|-------|------|-----|--------|
| `Product` | model/ | Entity (getters/setters) | 50% |
| `User` | model/ | Entity (getters/setters) | 50% |
| `HealthController` | controller/ | Non-critical endpoint | 60% |

---

## Quality Gates

### Build-Time Gates (CI/CD)

```yaml
# In GitHub Actions (.github/workflows/ci-build.yml)

- name: Run tests with coverage
  run: mvn clean test jacoco:report

- name: Check coverage thresholds
  run: |
    # Fail if coverage < 70% for controllers
    mvn jacoco:check -Djacoco.minimum=0.70
```

### Coverage-Based Decisions

| Coverage | Decision | Action |
|----------|----------|--------|
| **< 50%** | Critical | ❌ Block merge, add tests |
| **50-70%** | Warning | ⚠️ Request review, optional tests |
| **70-85%** | Good | ✅ Approve, monitor drift |
| **85%+** | Excellent | ✅ Approve, consider diminishing returns |

### Regression Prevention

```bash
# Compare coverage to previous build
mvn jacoco:report
# If coverage decreased:
# - Don't merge without explanation
# - Add tests for new/changed code
```

---

## Improving Coverage

### Step 1: Identify Uncovered Code

```bash
# After running: mvn clean test jacoco:report
# Open: backend/target/site/jacoco/index.html
# Click on class → scroll to red lines
```

### Step 2: Write Tests for Uncovered Lines

```java
// ❌ Uncovered code
if (product.getQuantity() < 5) {
    // This branch never tested
    log.warn("Low stock warning");
}

// ✅ Add test
@Test
void testLowStockWarning() {
    Product product = new Product("Test", 2, 100.0);
    mockMvc.perform(get("/api/products/1"))
        .andExpect(status().isOk());
    // Now warning branch is covered
}
```

### Step 3: Run Verification

```bash
mvn clean test jacoco:report
# Check index.html to confirm coverage improved
```

### Step 4: Set Coverage Gate (Prevent Regression)

```xml
<!-- pom.xml -->
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <configuration>
        <rules>
            <rule>
                <element>BUNDLE</element>
                <limits>
                    <limit>
                        <counter>LINE</counter>
                        <value>COVEREDRATIO</value>
                        <minimum>0.70</minimum>
                    </limit>
                </limits>
                <excludes>
                    <exclude>**/config/AppConfig.class</exclude>
                    <exclude>**/model/*.class</exclude>
                </excludes>
            </rule>
        </rules>
    </configuration>
    <executions>
        <execution>
            <goals>
                <goal>check</goal>  <!-- Fails build if threshold not met -->
            </goals>
        </execution>
    </executions>
</plugin>
```

---

## Coverage Reports in CI/CD

### Artifact Upload (GitHub Actions)

```yaml
# .github/workflows/ci-build.yml

- name: Upload coverage report
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: jacoco-report
    path: backend/target/site/jacoco/

- name: Publish to GitHub Pages
  uses: actions/upload-pages-artifact@v2
  with:
    path: backend/target/site/jacoco/
```

### View in GitHub Actions

1. Go to Actions → Recent build
2. Scroll to "Artifacts" section
3. Download `jacoco-report.zip`
4. Extract and open `index.html` in browser

### Publish to GitHub Pages

```bash
# After merge to main, coverage report auto-publishes to:
# https://keglev.github.io/stockease/coverage/

# Link in README.md:
# [![Coverage](https://img.shields.io/badge/coverage-70%25-yellow)](https://keglev.github.io/stockease/coverage/)
```

---

## Coverage Best Practices

### ✅ Do

- ✅ Test happy path (main flow)
- ✅ Test error cases (exceptions)
- ✅ Test authorization checks
- ✅ Test boundary conditions (empty lists, null values)
- ✅ Aim for 70%+ coverage on critical paths
- ✅ Use mutation testing to validate test quality

### ❌ Don't

- ❌ Aim for 100% coverage (diminishing returns)
- ❌ Test generated code (getters/setters on entities)
- ❌ Test Spring Framework code (security, config)
- ❌ Write tests just to increase coverage (test quality matters)
- ❌ Lower thresholds to pass build (fix code instead)

---

## Quality Metrics Dashboard (Future)

### Proposed Monitoring

```
Coverage Trends (Last 30 Days)

Line Coverage:     70% → 72% ↑ (Good)
Branch Coverage:   60% → 62% ↑ (Good)
Test Count:        9  → 12 ↑ (Growing)
Execution Time:    25s → 28s ↓ (Acceptable)

Top Uncovered Code:
1. Product.calculateDiscount() — 0% (unused feature)
2. AuthService.refreshToken() — 0% (future)
3. ValidationUtil.validateEmail() — 0% (imported, unused)
```

---

## Related Documentation

### Testing Fundamentals
- **[Testing Strategy](./strategy.md)** — Coverage goals
- **[Test Pyramid](./pyramid.md)** — Distribution of test types
- **[CI Pipeline Tests](./ci-pipeline-tests.md)** — Coverage in CI/CD

### Implementation
- **[Spring Slices](./spring-slices.md)** — How to write testable code
- **[Controller Integration Tests](./controller-integration.md)** — HTTP test examples
- **[Security Tests](./security-tests.md)** — Authorization coverage

### Main Architecture
- **[Testing Architecture](../testing-architecture.md)** — Entry point
- **[Backend Architecture](../backend.md)** — Code being measured
- **[Deployment](../deployment.md)** — Publishing reports

---

**Last Updated**: October 31, 2025  
**Version**: 1.0  
**Status**: ✅ Ready for implementation

[Back to Testing Index](../testing-architecture.md)
