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
│   ├── config/
│   │   ├── test/
│   │   │   └── TestConfig.java
│   │   ├── DataSeederTest.java
│   │   └── FlywayConfigurationTest.java
│   ├── controller/
│   │   ├── AuthControllerTest.java
│   │   ├── HealthControllerTest.java
│   │   ├── ProductControllerTest.java
│   │   ├── ProductCreateControllerTest.java
│   │   ├── ProductDeleteControllerTest.java
│   │   ├── ProductFetchControllerTest.java
│   │   ├── ProductInvalidUpdateControllerTest.java
│   │   ├── ProductPaginationControllerTest.java
│   │   └── ProductUpdateControllerTest.java
│   ├── exception/
│   │   └── GlobalExceptionHandlerTest.java
│   ├── model/
│   │   └── ProductTest.java
│   ├── security/
│   │   ├── CustomAuthenticationEntryPointTest.java
│   │   ├── CustomUserDetailsServiceTest.java
│   │   ├── JwtFilterTest.java
│   │   └── JwtUtilTest.java
│   └── StockEaseApplicationTests.java
└── resources/
    └── application-test.properties
```

---

## Navigation by Role

**Backend Developer**
Start with [Spring Slices](./spring-slices.md), then [Security Tests](./security-tests.md), then [Test Data & Fixtures](./test-data-fixtures.md).

**DevOps / CI Engineer**
Start with [CI Pipeline Tests](./ci-pipeline-tests.md), then [Coverage & Quality](./coverage-and-quality.md).

**QA / Test Engineer**
Start with [Test Pyramid](./pyramid.md), then [Coverage Matrix](./matrix.md), then [Naming Conventions](./naming-conventions.md).

**New to the project**
Start with [Testing Strategy](./strategy.md) for goals and scope, then [Coverage Matrix](./matrix.md) for what is covered.

---

## Documentation Index

### Strategy and Coverage
- [Testing Strategy](./strategy.md) — Goals, philosophy, and scope
- [Test Pyramid](./pyramid.md) — Test level distribution and rationale
- [Coverage Matrix](./matrix.md) — Full test inventory by layer, endpoint, and role
- [Coverage & Quality](./coverage-and-quality.md) — JaCoCo configuration and thresholds

### Implementation Reference
- [Spring Slices](./spring-slices.md) — `@WebMvcTest`, `@DataJpaTest`, `@SpringBootTest`
- [Controller Integration Tests](./controller-integration.md) — MockMvc request and assertion patterns
- [Security Tests](./security-tests.md) — JWT and role-based access control tests
- [Test Data & Fixtures](./test-data-fixtures.md) — TestConfig, mock setup, builder pattern
- [Naming Conventions](./naming-conventions.md) — Test class and method naming rules

### Operations
- [CI Pipeline Tests](./ci-pipeline-tests.md) — Pipeline gates and GitHub Actions workflow
- [Troubleshooting](./troubleshooting.md) — Common errors and fixes

---

## Related Architecture
- [System Overview](../system/overview.md)
- [Backend Architecture](../system/backend.md)
- [Security Architecture](../system/security.md)
- [Deployment](../deployment/infrastructure.md)

---

**Last Updated**: June 2026
**Status**: Current

[Back to Architecture Index](../index.md)
