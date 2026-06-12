# Testing Architecture

**Purpose**: Entry point for all testing documentation in StockEase. Use this to orient yourself, then follow the links to the relevant topic.

---

## Quick Start

**Prerequisites**: JDK 17+, Maven 3.8+, Spring Boot 3.5.7

```bash
# Run all tests
cd backend && mvn clean test

# Run a specific test class
mvn test -Dtest=AuthControllerTest

# Run tests with coverage report
mvn clean test jacoco:report

# Open coverage report
open backend/target/site/jacoco/index.html
```

---

## Test Directory Layout

```
backend/src/test/
├── java/com/stocks/stockease/
│   ├── config/test/
│   │   └── TestConfig.java
│   ├── controller/
│   │   ├── AuthControllerTest.java
│   │   ├── ProductControllerTest.java
│   │   ├── ProductCreateControllerTest.java
│   │   ├── ProductDeleteControllerTest.java
│   │   ├── ProductFetchControllerTest.java
│   │   ├── ProductInvalidUpdateControllerTest.java
│   │   ├── ProductPaginationControllerTest.java
│   │   └── ProductUpdateControllerTest.java
│   └── StockEaseApplicationTests.java
└── resources/
    └── application-test.properties
```

---

## Navigation by Role

**Backend Developer**
Start with [Spring Slices](./testing/spring-slices.md), then [Security Tests](./testing/security-tests.md), then [Test Data & Fixtures](./testing/test-data-fixtures.md).

**DevOps / CI Engineer**
Start with [CI Pipeline Tests](./testing/ci-pipeline-tests.md), then [Coverage & Quality](./testing/coverage-and-quality.md).

**QA / Test Engineer**
Start with [Test Pyramid](./testing/pyramid.md), then [Coverage Matrix](./testing/matrix.md), then [Naming Conventions](./testing/naming-conventions.md).

**New to the project**
Start with [Testing Strategy](./testing/strategy.md) for goals and scope, then [Coverage Matrix](./testing/matrix.md) for what is covered.

---

## Documentation Index

### Strategy and Coverage
- [Testing Strategy](./testing/strategy.md) — Goals, philosophy, and scope
- [Test Pyramid](./testing/pyramid.md) — Test level distribution and rationale
- [Coverage Matrix](./testing/matrix.md) — Full test inventory by layer, endpoint, and role
- [Coverage & Quality](./testing/coverage-and-quality.md) — JaCoCo configuration and thresholds

### Implementation Reference
- [Spring Slices](./testing/spring-slices.md) — `@WebMvcTest`, `@DataJpaTest`, `@SpringBootTest`
- [Controller Integration Tests](./testing/controller-integration.md) — MockMvc request and assertion patterns
- [Security Tests](./testing/security-tests.md) — JWT and role-based access control tests
- [Test Data & Fixtures](./testing/test-data-fixtures.md) — TestConfig, mock setup, builder pattern
- [Naming Conventions](./testing/naming-conventions.md) — Test class and method naming rules

### Operations
- [CI Pipeline Tests](./testing/ci-pipeline-tests.md) — Pipeline gates and GitHub Actions workflow
- [Troubleshooting](./testing/troubleshooting.md) — Common errors and fixes

---

## Related Architecture
- [System Overview](./system/overview.md)
- [Backend Architecture](./system/backend.md)
- [Security Architecture](./system/security.md)
- [Deployment](./deployment/deployment.md)

---

**Last Updated**: June 2026
**Status**: Current

[Back to Architecture Index](./index.md)
