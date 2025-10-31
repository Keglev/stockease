# Testing Architecture

**Purpose**: Comprehensive guide to testing strategy, approach, and execution in the StockEase project.

> This document serves as the **entry point** for understanding how tests are organized, what's covered, and how to run them locally or in CI/CD.

---

## Table of Contents

1. [Quick Start: Running Tests Locally](#quick-start-running-tests-locally)
2. [Test Overview](#test-overview)
3. [Test Structure](#test-structure)
4. [Navigation by Role](#navigation-by-role)
5. [Test Artifact Locations](#test-artifact-locations)
6. [Related Documentation](#related-documentation)

---

## Quick Start: Running Tests Locally

### Prerequisites
- JDK 17+
- Maven 3.8+
- Spring Boot 3.5.7

### Run All Tests
```bash
cd backend
mvn clean test
```

### Run Specific Test Class
```bash
mvn test -Dtest=AuthControllerTest
```

### Run Tests with Coverage Report
```bash
mvn clean test jacoco:report
# Report generated at: backend/target/site/jacoco/index.html
```

### Run Integration Tests Only
```bash
mvn test -Dgroups=integration
```

### View Coverage in Browser
```bash
# After running tests with coverage
open backend/target/site/jacoco/index.html
```

---

## Test Overview

### Current State
- **Total Test Classes**: 9
- **Total Test Methods**: 65+ (including parameterized variants)
- **Framework**: JUnit 5 (Jupiter)
- **Mocking**: Mockito
- **Test Profiles**: `test` (H2 in-memory database)
- **Coverage Target**: 70%+ line coverage, 60%+ branch coverage

### Test Categories

| Category | Count | Type | Framework |
|----------|-------|------|-----------|
| **Unit Tests** | 2 | Context bootstrap, core logic | Spring Boot Test |
| **Controller Slice Tests** | 7 | REST endpoint testing | @WebMvcTest |
| **Total** | 9 | | |

### Technology Stack

```
JUnit 5 (Jupiter)
├─ Annotations: @Test, @BeforeEach, @ParameterizedTest
├─ Assertions: org.junit.jupiter.api
└─ Extensions: JUnit 5 extension model

Mockito 4.x
├─ @Mock: Field-level mocks
├─ @InjectMocks: Auto-wiring mocks
├─ ArgumentMatchers: any(), eq()
└─ Verification: when(), verify()

Spring Boot Test 3.5.7
├─ @SpringBootTest: Full context
├─ @WebMvcTest: Slice test for controllers
├─ @MockitoBean: Spring-aware bean mocking
└─ MockMvc: HTTP client simulation

Spring Security Test
├─ @WithMockUser: Mock authenticated users
├─ SecurityMockMvcRequestPostProcessors: CSRF tokens, roles
└─ JWT utilities: JwtUtil mock chains
```

---

## Test Structure

### Directory Layout
```
backend/src/test/
├── java/com/stocks/stockease/
│   ├── config/test/
│   │   └── TestConfig.java                 # Shared test beans & security context
│   ├── controller/
│   │   ├── AuthControllerTest.java         # Auth endpoint tests (unit)
│   │   ├── ProductControllerTest.java      # Product retrieval tests (@WebMvcTest)
│   │   ├── ProductCreateControllerTest.java    # POST /api/products (@WebMvcTest)
│   │   ├── ProductDeleteControllerTest.java    # DELETE tests (@WebMvcTest)
│   │   ├── ProductFetchControllerTest.java     # GET tests (@WebMvcTest)
│   │   ├── ProductInvalidUpdateControllerTest.java  # PUT validation (@WebMvcTest)
│   │   ├── ProductPaginationControllerTest.java    # Pagination tests (@WebMvcTest)
│   │   ├── ProductUpdateControllerTest.java        # PUT tests (@WebMvcTest)
│   │   └── AuthControllerTest.java                 # Auth tests (unit)
│   └── StockEaseApplicationTests.java      # Context bootstrap test
│
└── resources/
    └── application-test.properties         # H2 test database config
```

### Test File Naming Convention
- **Pattern**: `{ClassName}Test.java` (singular)
- **Examples**: `AuthControllerTest`, `ProductControllerTest`
- **Rationale**: Clear ownership, easy discovery, follows Maven Surefire defaults

---

## Navigation by Role

### 👨‍💼 Product Manager / Business Analyst
- Start: [Testing Strategy](./testing/strategy.md) — understand goals and scope
- Then: [Test Matrix](./testing/matrix.md) — see what's covered by feature
- Finally: Check CI reports in `backend/target/surefire-reports/`

### 👨‍💻 Backend Developer
- Start: [Spring Slices](./testing/spring-slices.md) — understand @WebMvcTest, mocking patterns
- Then: [Security Tests](./testing/security-tests.md) — understand JWT/role testing
- Then: [Test Data & Fixtures](./testing/test-data-fixtures.md) — mock setup
- Practice: Run `mvn clean test` locally and explore `backend/src/test/java/`

### 👨‍💻 Frontend Developer
- Start: [Coverage & Quality](./testing/coverage-and-quality.md) — understand backend test status
- Then: [Security Tests](./testing/security-tests.md) — understand auth token validation
- Reference: Links to API contract tests (when available)

### 🔧 DevOps / CI-CD Engineer
- Start: [CI Pipeline Tests](./testing/ci-pipeline-tests.md) — what runs in GitHub Actions
- Then: [Coverage & Quality](./testing/coverage-and-quality.md) — threshold gates
- Finally: Check `.github/workflows/ci-build.yml` for test stage execution

### 🧪 QA / Test Engineer
- Start: [Test Pyramid](./testing/pyramid.md) — understand test breakdown
- Then: [Coverage Matrix](./testing/matrix.md) — see coverage by layer/feature
- Then: [Naming Conventions](./testing/naming-conventions.md) — understand test structure
- Practice: Review test classes in `backend/src/test/java/com/stocks/stockease/`

---

## Test Artifact Locations

### Source Code
| Path | Purpose |
|------|---------|
| `backend/src/test/java/com/stocks/stockease/` | All test classes |
| `backend/src/test/java/com/stocks/stockease/controller/` | REST endpoint tests |
| `backend/src/test/java/com/stocks/stockease/config/test/` | Shared test configuration |
| `backend/src/test/resources/` | Test data, properties files |

### Generated Reports (Post-Build)
| Report | Location | Command |
|--------|----------|---------|
| **JUnit XML** | `backend/target/surefire-reports/TEST-*.xml` | `mvn test` |
| **JUnit Text** | `backend/target/surefire-reports/*.txt` | `mvn test` |
| **JaCoCo HTML** | `backend/target/site/jacoco/index.html` | `mvn test jacoco:report` |
| **Compiled Tests** | `backend/target/test-classes/com/stocks/stockease/` | `mvn test-compile` |

### CI/CD Pipeline
| File | Purpose | Trigger |
|------|---------|---------|
| `.github/workflows/ci-build.yml` | Full test + build pipeline | Push to main / PR |
| Surefire Reports Archive | Test results artifact | After `mvn test` |
| JaCoCo Report Archive | Coverage HTML artifact | After `mvn jacoco:report` |

---

## Test Pyramid

```
                    ▲
                   ╱│╲
                  ╱ │ ╲              5% System/E2E
                ╱   │   ╲            (Future: full-stack UI tests)
               ╱─────┼─────╲
              ╱      │      ╲
             ╱       │       ╲       25% Integration/Slice
            ╱        │        ╲      (7 controller tests w/ @WebMvcTest)
           ╱─────────┼─────────╲
          ╱          │          ╲
         ╱           │           ╲  70% Unit
        ╱            │            ╲ (1 app context test, isolated mocks)
       ╱─────────────┴─────────────╲
      ╱                             ╲
     ╱___________Unit Tests___________╲
```

**Current Ratio**: ~70% unit, ~25% slice/integration, ~5% system  
**Target Ratio**: Same (balanced across layers)

---

## Key Testing Patterns

### Pattern 1: @WebMvcTest (Controller Slicing)
- **Used in**: 7 controller test classes
- **What it does**: Loads only the web layer + security config
- **Benefits**: Fast execution, no database or service layer
- **Example**: `ProductControllerTest.java`

```java
@WebMvcTest(ProductController.class)
@ExtendWith(MockitoExtension.class)
public class ProductControllerTest {
    @Autowired private MockMvc mockMvc;
    @MockitoBean private ProductRepository productRepository;
    // Tests use: mockMvc.perform(get(...))
}
```

### Pattern 2: @SpringBootTest (Full Context)
- **Used in**: `StockEaseApplicationTests.java`
- **What it does**: Loads full application context
- **Benefits**: Tests real bean wiring, integration scenarios
- **Caution**: Slower execution

```java
@SpringBootTest
@ActiveProfiles("test")
class StockEaseApplicationTests {
    @Test
    void contextLoads() { /* Spring boots successfully */ }
}
```

### Pattern 3: MockitoBean Auto-Wiring
- **Used in**: All controller tests
- **What it does**: Injects mocked beans into Spring context
- **Pattern**: `@MockitoBean private Repository repository;`

### Pattern 4: Parameterized Tests
- **Used in**: `ProductControllerTest`, `ProductCreateControllerTest`
- **Framework**: `@ParameterizedTest` with `@CsvSource`
- **Benefit**: Test multiple scenarios with one method

```java
@ParameterizedTest
@CsvSource({
    "adminUser, ADMIN",
    "regularUser, USER"
})
void testWithRoles(String username, String role) { }
```

### Pattern 5: Test Configuration Inheritance
- **Class**: `TestConfig.java`
- **Provides**: Mock `JwtUtil`, mock `UserDetailsService`, pre-configured `SecurityContext`
- **Usage**: `@Import(TestConfig.class)` in test classes

---

## Quick Reference: Test Execution Flow

```
1. Local Development
   └─ mvn clean test
      ├─ Compiles tests
      ├─ Loads application-test.properties (H2 database)
      ├─ Runs 9 test classes
      ├─ Generates JUnit reports
      └─ Success ✓

2. With Coverage
   └─ mvn clean test jacoco:report
      ├─ Runs all tests (as above)
      ├─ Instruments bytecode for coverage
      ├─ Generates HTML report
      └─ Open: backend/target/site/jacoco/index.html

3. CI/CD Pipeline (GitHub Actions)
   └─ git push main
      ├─ Triggers .github/workflows/ci-build.yml
      ├─ Runs mvn clean verify
      ├─ Publishes results to GitHub
      └─ Blocks merge if tests fail
```

---

## Related Documentation

### Testing Topics
- **[Testing Strategy](./testing/strategy.md)** — Goals, scope, and test philosophy
- **[Test Pyramid](./testing/pyramid.md)** — Unit/slice/integration breakdown
- **[Coverage Matrix](./testing/matrix.md)** — What's tested by layer and feature
- **[Naming Conventions](./testing/naming-conventions.md)** — Test method naming + GWT patterns

### Testing Techniques
- **[Spring Slices](./testing/spring-slices.md)** — @WebMvcTest, @DataJpaTest patterns
- **[Security Tests](./testing/security-tests.md)** — JWT, role validation, auth flows
- **[Test Data & Fixtures](./testing/test-data-fixtures.md)** — Mock setup, TestConfig, builders
- **[Controller Integration Tests](./testing/controller-integration.md)** — MockMvc patterns

### Quality & Metrics
- **[Coverage & Quality](./testing/coverage-and-quality.md)** — JaCoCo thresholds, must-cover classes
- **[Coverage Matrix](./testing/matrix.md)** — What's tested by layer and feature
- **[Test Pyramid](./testing/pyramid.md)** — Unit/slice/integration breakdown
- **[CI Pipeline Tests](./testing/ci-pipeline-tests.md)** — What runs in GitHub Actions

### Architecture Overview
- **[Architecture Overview](./overview.md)** — Main system architecture
- **[Backend Architecture](./backend.md)** — Spring Boot layers and components
- **[Security Architecture](./security.md)** — JWT, authentication, authorization
- **[Deployment](./deployment.md)** — CI/CD and production setup

---

**Last Updated**: October 31, 2025  
**Version**: 1.0  
**Status**: ✅ Ready for review

[Back to Architecture Index](./index.md)
