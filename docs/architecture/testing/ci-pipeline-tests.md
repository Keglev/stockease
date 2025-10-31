# CI Pipeline Tests

**Purpose**: Document how tests are executed in GitHub Actions CI/CD pipeline and what gates prevent merge failures.

---

## Table of Contents

1. [CI Pipeline Overview](#ci-pipeline-overview)
2. [Test Execution Stages](#test-execution-stages)
3. [Quality Gates](#quality-gates)
4. [Failure Handling](#failure-handling)
5. [Artifacts & Reports](#artifacts--reports)
6. [Related Documentation](#related-documentation)

---

## CI Pipeline Overview

### Current Setup (Proposed)

**File**: `.github/workflows/ci-build.yml`

```
Push to main/PR
    ↓
Checkout code
    ↓
Setup JDK 17
    ↓
[GATE 1] Build
    mvn clean compile
    ↓ (fails → block merge)
    ↓
[GATE 2] Unit & Slice Tests
    mvn test
    ↓ (fails → block merge)
    ↓
[GATE 3] Coverage Report
    mvn jacoco:report
    ↓ (coverage < 70% → block merge)
    ↓
[GATE 4] Code Quality
    mvn spotbugs:check (lint)
    ↓ (errors → block merge)
    ↓
✅ SUCCESS - Auto-merge enabled
    ↓
Deploy to staging/prod
```

### Test Execution Timeline

```
Stage 1: Compilation    ~10 seconds (fast fail)
Stage 2: Tests          ~30 seconds (main wait)
Stage 3: Coverage       ~15 seconds
Stage 4: Code Quality   ~5 seconds
────────────────────────────
Total:                  ~60 seconds
```

---

## Test Execution Stages

### Stage 1: Compilation

**Command**:
```bash
mvn clean compile
```

**What it does**:
- Compiles source code
- Catches syntax errors early
- Fails if Java/Spring version mismatches

**Output**:
```
[INFO] Compiling 15 source files
[INFO] BUILD SUCCESS
```

**Fail Condition**: Any Java syntax error

---

### Stage 2: Unit & Slice Tests

**Command**:
```bash
mvn test
```

**What it runs**:
- All 9 test classes
- Generates JUnit reports
- ~65+ test methods (including parameterized variants)

**Test Categories Run**:
```
1. AuthControllerTest               (4 methods)
2. ProductControllerTest            (3-4 methods)
3. ProductCreateControllerTest       (3 methods)
4. ProductFetchControllerTest        (4-5 methods)
5. ProductUpdateControllerTest       (3 methods)
6. ProductDeleteControllerTest       (2 methods)
7. ProductPaginationControllerTest   (2 methods)
8. ProductInvalidUpdateControllerTest (1-2 methods)
9. StockEaseApplicationTests        (1 method)
```

**Output**:
```
[INFO] -------------------------------------------------------
[INFO] T E S T S
[INFO] -------------------------------------------------------
[INFO] Running com.stocks.stockease.controller.AuthControllerTest
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] Running com.stocks.stockease.controller.ProductControllerTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
...
[INFO] BUILD SUCCESS
```

**Reports Generated**:
- `backend/target/surefire-reports/*.xml` — JUnit XML
- `backend/target/surefire-reports/*.txt` — Test summary
- `backend/target/test-classes/` — Compiled tests

**Fail Condition**: Any test fails or errors

---

### Stage 3: Coverage Report

**Command**:
```bash
mvn jacoco:report
```

**What it does**:
- Instruments bytecode for coverage measurement
- Runs tests again (with coverage tracking)
- Generates HTML report
- Calculates coverage percentages

**Output**:
```
[INFO] Jacoco Reports
[INFO] -------------------------------------------------------
[INFO] Class Coverage: 40% (4/10)
[INFO] Line Coverage: 65% (195/300)
[INFO] Branch Coverage: 55% (55/100)
[INFO] Method Coverage: 75% (30/40)
[INFO] Complexity Coverage: 60%
[INFO] BUILD SUCCESS
```

**Reports Generated**:
- `backend/target/site/jacoco/index.html` — Main report
- `backend/target/site/jacoco/com/stocks/stockease/controller/` — Package details
- `backend/target/site/jacoco/StatusCode.xml` — Machine-readable

**Fail Condition**: Coverage < configured minimum (optional gate)

---

### Stage 4: Code Quality Check

**Command** (proposed):
```bash
mvn spotbugs:check  # or PMD, CheckStyle
```

**What it does** (when configured):
- Scans for common bugs
- Checks code style violations
- Flags security issues
- Performance problems

**Output**:
```
[INFO] SpotBugs check
[WARNING] High priority: Null pointer dereference in AuthController
[WARNING] Medium priority: Unclosed resource in ProductService
[INFO] BUILD SUCCESS
```

**Fail Condition**: High-priority issues found (depends on configuration)

---

## Quality Gates

### Gate 1: Build Must Succeed

```
Condition: No compilation errors
Success: ✅ Code compiles
Failure: ❌ Syntax error → BLOCK merge
Action: Fix Java/Spring errors
```

### Gate 2: All Tests Must Pass

```
Condition: All 9 test classes pass
Success: ✅ 0 failures, 0 errors
Failure: ❌ Any test fails → BLOCK merge
Action: Fix test/code issue
```

### Gate 3: Coverage Minimum (Optional)

```
Condition: Line coverage ≥ 70%
Success: ✅ Coverage = 72%
Failure: ❌ Coverage = 65% → REQUEST review
Action: Add tests for uncovered code
```

### Gate 4: Code Quality (Optional)

```
Condition: No high-priority bugs
Success: ✅ 0 issues
Failure: ⚠️  1 issue → WARN but allow merge
Action: Fix or add suppression
```

---

## Failure Handling

### Scenario 1: Test Fails in CI

```
User pushes code to PR
    ↓
CI runs: mvn test
    ↓
❌ FAILURE: ProductControllerTest.testGetProductsEmpty
    │        Expected 0 items, got 1
    ↓
GitHub marks PR as ❌ FAILED
    ↓
PR cannot be merged until fixed
    ↓
User must:
1. View failure details in GitHub Actions
2. Fix code or test
3. Push fix to same PR
4. CI re-runs automatically
5. When all pass, PR can merge
```

### Scenario 2: Coverage Drops

```
Previous build: 72% coverage (PASS)
New build: 68% coverage (FAIL if gate active)
    ↓
CI logs warning:
  "Coverage dropped from 72% to 68%"
  "New test needed for: ProductService.validatePrice()"
    ↓
Options:
- Add test to increase coverage back to 72%
- Request review if acceptable drop
- Adjust threshold if rate-limited
```

### Scenario 3: Flaky Test

```
Test sometimes passes, sometimes fails
    ↓
CI output: FAILURE on attempt 1
    ↓
Actions:
- Review test for timing issues (sleep, race conditions)
- Use @BeforeEach to reset state properly
- Mock external dependencies consistently
- Increase retry count if infrastructure issue
```

---

## Artifacts & Reports

### Test Reports

**Location**: `backend/target/surefire-reports/`

```
TEST-com.stocks.stockease.controller.AuthControllerTest.xml
TEST-com.stocks.stockease.controller.ProductControllerTest.xml
TEST-com.stocks.stockease.controller.ProductCreateControllerTest.xml
...
com.stocks.stockease.controller.AuthControllerTest.txt
com.stocks.stockease.controller.ProductControllerTest.txt
...
```

**Upload to Artifacts**:
```yaml
# .github/workflows/ci-build.yml

- name: Upload test reports
  uses: actions/upload-artifact@v3
  if: always()  # Always upload, even if tests fail
  with:
    name: test-reports
    path: backend/target/surefire-reports/
    retention-days: 30
```

**View in GitHub**:
1. Go to Actions → Recent run
2. Scroll to Artifacts section
3. Download `test-reports.zip`
4. Open XML or txt files

### Coverage Reports

**Location**: `backend/target/site/jacoco/`

```
index.html
com/stocks/stockease/controller/
  AuthController.java.html
  ProductController.java.html
  ...
```

**Upload to Artifacts**:
```yaml
- name: Upload coverage report
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: coverage-report
    path: backend/target/site/jacoco/
    retention-days: 30
```

**Publish to GitHub Pages**:
```yaml
- name: Deploy coverage to Pages
  uses: actions/upload-pages-artifact@v2
  with:
    path: backend/target/site/jacoco/
    
# Result: 
# https://keglev.github.io/stockease/coverage/
```

---

## Build Status Badge

### Display in README

```markdown
![Build Status](https://github.com/keglev/stockease/workflows/CI/badge.svg)
![Coverage](https://img.shields.io/badge/coverage-72%25-yellow)
![Tests](https://img.shields.io/badge/tests-65%2B-blue)
```

### Links to Reports

```markdown
## Test Results

- [Latest Build](https://github.com/keglev/stockease/actions)
- [Coverage Report](https://keglev.github.io/stockease/coverage/)
- [Test Logs](https://github.com/keglev/stockease/actions/workflows/ci-build.yml)
```

---

## Typical CI Workflow

### Scenario: Developer Pushes New Feature

```
1. Developer commits ProductCreateControllerTest changes
2. Pushes to branch: feature/admin-create-product
3. Creates PR → Runs CI

GitHub Actions Workflow:
├─ Checkout code
├─ Setup JDK 17
├─ mvn clean compile          ✅ Pass
├─ mvn test                   ✅ Pass (9 classes)
├─ mvn jacoco:report          ✅ Pass (72% coverage)
├─ mvn spotbugs:check         ✅ Pass (no issues)
└─ ✅ SUCCESS

GitHub UI:
├─ PR shows ✅ All checks passed
├─ Green checkmark on PR
├─ "Merge pull request" button enabled
└─ Maintainer can click to merge

After Merge:
├─ CI runs again on main branch
├─ All checks pass
├─ Auto-deploys to staging (if configured)
└─ Feature live on main
```

---

## Performance Optimization

### Current Performance

```
Compilation:     ~10 seconds
Tests:           ~30 seconds  (bottleneck)
Coverage:        ~15 seconds
Quality:         ~5 seconds
────────────────────────────
Total:           ~60 seconds
```

### Optimization Options

| Optimization | Impact | Complexity |
|---|---|---|
| Parallel test execution | Save 10-15 sec | Medium |
| Test caching | Save 5-10 sec | High |
| Smaller Docker images | Save 5 sec | Low |
| Split CI into sub-jobs | Psychological | High |

---

## Debugging CI Failures

### Step 1: Review Failure Log

```
1. Go to Actions → Recent run
2. Click failed job
3. Expand test output
4. Find [ERROR] or [FAILED] lines
5. Note exact failure message
```

### Step 2: Reproduce Locally

```bash
# On your machine:
cd backend
mvn clean test

# If it passes locally but fails in CI:
# - Different JDK version (use jdk-17 in CI)
# - Different environment variables
# - Timing/race condition (flaky test)
# - File permission issue
```

### Step 3: Check CI Configuration

```bash
# Review .github/workflows/ci-build.yml:
# - JDK version matches local
# - Maven version specified
# - Test timeout settings
# - Environment variables set
```

### Step 4: Add Debug Output

```java
// Add logging in test
@Test
void testFailing() {
    System.out.println("DEBUG: Starting test");
    System.out.println("DEBUG: Product = " + product);
    assertThat(result).isEqualTo(expected);
}

// Re-run and check CI logs
```

---

## Related Documentation

### Testing Fundamentals
- **[Testing Strategy](./strategy.md)** — CI scope and philosophy
- **[Coverage & Quality](./coverage-and-quality.md)** — JaCoCo in CI
- **[Test Pyramid](./pyramid.md)** — Test distribution

### Implementation
- **[Spring Slices](./spring-slices.md)** — Tests run in CI
- **[Controller Integration Tests](./controller-integration.md)** — HTTP tests

### Architecture
- **[Testing Architecture](../testing-architecture.md)** — Entry point
- **[Deployment](../deployment.md)** — CI/CD pipeline details
- **[Backend Architecture](../backend.md)** — Code being tested

---

**Last Updated**: October 31, 2025  
**Version**: 1.0  
**Status**: ✅ Proposal ready for implementation

[Back to Testing Index](../testing-architecture.md)
