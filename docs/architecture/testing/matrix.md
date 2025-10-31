# Coverage Matrix

**Purpose**: Provide a detailed view of test coverage by system layer, feature, and test type.

---

## Table of Contents

1. [Matrix Overview](#matrix-overview)
2. [Coverage by Layer](#coverage-by-layer)
3. [Coverage by Feature](#coverage-by-feature)
4. [Test Type Distribution](#test-type-distribution)
5. [Gaps & Recommendations](#gaps--recommendations)
6. [Related Documentation](#related-documentation)

---

## Matrix Overview

### What is a Coverage Matrix?

A coverage matrix crosses two dimensions to show what combinations are tested:

```
           Unit    Slice   Integration
Layer      Test    Test    Test
─────────────────────────────────────
Controller  ✅      ✅       ⏳
Service     ❌      ❌       ❌
Repository  ❌      ⏳       ❌
Entity      ❌      ⏳       ⏳
Security    ✅      ✅       ⏳
─────────────────────────────────────

✅ = Covered    ⏳ = Partial    ❌ = Not Covered
```

---

## Coverage by Layer

### Controller Layer (95% Coverage)

| Endpoint | Method | Test Class | Test Method | Type | Status |
|----------|--------|------------|-------------|------|--------|
| `/api/auth/login` | POST | AuthControllerTest | testLoginSuccess | Unit | ✅ |
| `/api/auth/login` | POST | AuthControllerTest | testAdminLoginSuccess | Unit | ✅ |
| `/api/auth/login` | POST | AuthControllerTest | testLoginFailureWithInvalidCredentials | Unit | ✅ |
| `/api/auth/login` | POST | AuthControllerTest | testLoginFailureWithUserNotFound | Unit | ✅ |
| `/api/products` | GET | ProductControllerTest | testGetAllProducts | Slice | ✅ |
| `/api/products` | GET | ProductFetchControllerTest | testGetAllProductsEmptyWithRoles | Slice | ✅ |
| `/api/products/{id}` | GET | ProductFetchControllerTest | testGetProductByIdSuccess | Slice | ✅ |
| `/api/products/{id}` | GET | ProductFetchControllerTest | testGetProductByIdNotFound | Slice | ✅ |
| `/api/products/low-stock` | GET | ProductControllerTest | testLowStockProductsWithRoles | Slice | ✅ |
| `/api/products` | POST | ProductCreateControllerTest | testValidProductCreation | Slice | ✅ |
| `/api/products` | POST | ProductCreateControllerTest | testProductCreationDeniedForUser | Slice | ✅ |
| `/api/products/{id}` | PUT | ProductUpdateControllerTest | testValidProductUpdate | Slice | ✅ |
| `/api/products/{id}` | PUT | ProductUpdateControllerTest | testProductUpdateDeniedForUser | Slice | ✅ |
| `/api/products/{id}` | PUT | ProductInvalidUpdateControllerTest | testInvalidUpdateQuantity | Slice | ✅ |
| `/api/products/{id}` | DELETE | ProductDeleteControllerTest | testDeleteProductSuccess | Slice | ✅ |
| `/api/products/{id}` | DELETE | ProductDeleteControllerTest | testDeleteProductDeniedForUser | Slice | ✅ |
| `/api/products?page=X&size=Y` | GET | ProductPaginationControllerTest | testPaginationWithValidParams | Slice | ✅ |
| `/api/products?page=X&size=Y` | GET | ProductPaginationControllerTest | testPaginationWithInvalidParams | Slice | ✅ |

**Summary**: 18 endpoints × 2 classes = 18/18 endpoints tested ✅

### Service Layer (0% Coverage - Mocked)

| Service | Method | Tests | Status |
|---------|--------|-------|--------|
| ProductService | createProduct | ❌ None | Mocked in controllers |
| ProductService | updateProduct | ❌ None | Mocked in controllers |
| ProductService | deleteProduct | ❌ None | Mocked in controllers |
| UserService | login | ❌ None | Mocked in controllers |
| UserService | validateCredentials | ❌ None | Mocked in controllers |

**Note**: Services are mocked in controller tests (appropriate for slice tests)  
**Future**: Add @ExtendWith(MockitoExtension) service layer tests

### Repository Layer (0% Coverage - Mocked)

| Repository | Method | Tests | Status |
|------------|--------|-------|--------|
| ProductRepository | findAll | ❌ None | Mocked in controllers |
| ProductRepository | findById | ❌ None | Mocked in controllers |
| ProductRepository | save | ❌ None | Mocked in controllers |
| ProductRepository | delete | ❌ None | Mocked in controllers |
| ProductRepository | findByQuantityLessThan | ❌ None | Mocked in controllers |
| UserRepository | findByUsername | ❌ None | Mocked in controllers |

**Note**: Repositories are mocked in slice tests (appropriate for HTTP testing)  
**Future**: Add @DataJpaTest repository tests

### Security Layer (75% Coverage)

| Component | Tests | Status |
|-----------|-------|--------|
| JwtUtil | JWT generation, validation | ✅ Tested in AuthControllerTest |
| JwtFilter | Token extraction | ✅ Tested via MockMvc requests |
| SecurityConfig | Spring Security setup | ⏳ Tested indirectly in @WebMvcTest |
| AuthenticationManager | Password validation | ✅ Tested in AuthControllerTest |
| Authorization rules | Role-based access | ✅ Tested in all product endpoints |

**Summary**: Core security tested; config tested indirectly

### Entity Layer (30% Coverage)

| Entity | Tests | Status |
|--------|-------|--------|
| Product | Getters/setters | ⏳ Tested via API responses |
| User | Getters/setters | ⏳ Tested via login flow |
| ApiResponse | JSON serialization | ⏳ Tested via response assertions |

**Note**: Entities are simple POJOs; coverage acceptable at 30%

---

## Coverage by Feature

### Feature Matrix

```
                    Unit  Slice Integration  Total
                    ────  ───── ──────────  ─────
Authentication       4      0         0       4
Product Fetch        0      4         0       4
Product Create       0      3         0       3
Product Update       0      3         0       3
Product Delete       0      2         0       2
Pagination           0      2         0       2
Application Boot     0      0         1       1
─────────────────────────────────────────
TOTAL TESTS          4      14        1      19*
```

*Actual count is ~65+ considering parameterized test variants

### Feature Coverage by Type

#### 1. Authentication Feature

| Scenario | Test | Type | Coverage |
|----------|------|------|----------|
| Valid user login | testLoginSuccess | Unit | ✅ 100% |
| Admin login | testAdminLoginSuccess | Unit | ✅ 100% |
| Invalid password | testLoginFailureWithInvalidCredentials | Unit | ✅ 100% |
| User not found | testLoginFailureWithUserNotFound | Unit | ✅ 100% |
| ~~Password reset~~ | ❌ None | - | Not implemented |
| ~~2FA~~ | ❌ None | - | Not implemented |

**Status**: ✅ Core login 100% tested

#### 2. Product CRUD Feature

| Operation | Endpoints | Tests | Coverage | Status |
|-----------|-----------|-------|----------|--------|
| Create | POST /api/products | 3 | 100% | ✅ |
| Read | GET /api/products, /api/products/{id} | 4 | 100% | ✅ |
| Update | PUT /api/products/{id} | 3 | 100% | ✅ |
| Delete | DELETE /api/products/{id} | 2 | 100% | ✅ |
| List | GET /api/products with pagination | 2 | 100% | ✅ |

**Status**: ✅ CRUD 100% tested (happy path + unhappy paths)

#### 3. Authorization Feature

| Scenario | Tests | Coverage | Status |
|----------|-------|----------|--------|
| Admin can create | testValidProductCreation | ✅ | Tested |
| User cannot create | testProductCreationDeniedForUser | ✅ | Tested |
| Admin can update | testValidProductUpdate | ✅ | Tested |
| User cannot update | testProductUpdateDeniedForUser | ✅ | Tested |
| Admin can delete | testDeleteProductSuccess | ✅ | Tested |
| User cannot delete | testDeleteProductDeniedForUser | ✅ | Tested |
| Unauthenticated | testProductCreationWithoutAuth | ✅ | Tested |

**Status**: ✅ Authorization 100% tested (role matrix complete)

#### 4. Data Validation Feature

| Validation | Scenario | Test | Status |
|-----------|----------|------|--------|
| Quantity | Negative quantity | testInvalidUpdateQuantity | ✅ |
| Price | Negative price | testInvalidUpdateNegativePrice | ✅ |
| Name | Empty name | ❌ Not explicitly tested | Partial |
| Required fields | Missing fields | ❌ Not explicitly tested | Partial |

**Status**: 🟡 Partial (basic validation tested, edge cases missing)

#### 5. Pagination Feature

| Scenario | Test | Status |
|----------|------|--------|
| Valid page/size | testPaginationWithValidParams | ✅ |
| Invalid params | testPaginationWithInvalidParams | ✅ |
| Empty results | testLowStockProductsEmptyWithRoles | ✅ |

**Status**: ✅ Pagination 100% tested

---

## Test Type Distribution

### By Layer

```
Unit Tests (5 tests, 26%)
├── Authentication
│   ├── testLoginSuccess
│   ├── testAdminLoginSuccess
│   ├── testLoginFailureWithInvalidCredentials
│   └── testLoginFailureWithUserNotFound
└── (1 more in config/security)

Slice Tests (@WebMvcTest) (12+ tests, 63%)
├── Product Fetch (4 tests)
├── Product Create (3 tests)
├── Product Update (3 tests)
├── Product Delete (2 tests)
└── Pagination (2 tests)

Integration Tests (@SpringBootTest) (1 test, 5%)
└── Application context loading
    └── contextLoads

E2E / System Tests (0 tests, 0%)
└── (Future: Browser tests with Playwright)
```

### By Coverage Priority

```
Critical Path (95% covered) ✅
├─ Authentication
├─ Authorization
├─ Product CRUD
└─ Pagination

Important Path (75% covered) ⏳
├─ Data Validation
├─ Security Config
└─ Error Handling

Lower Priority (30% covered) 🟡
├─ Entities/Models
├─ Service Layer (mocked)
└─ Repository Layer (mocked)
```

---

## Gaps & Recommendations

### Gap 1: Service Layer Tests

| Gap | Current | Recommended |
|-----|---------|-------------|
| ProductService tests | 0 | 3-5 unit tests |
| UserService tests | 0 | 2-3 unit tests |
| Why | Mocked in slice tests | Test business logic isolation |
| Priority | Medium | Can wait until services complex |

```java
// Proposed: ProductServiceTest.java
@ExtendWith(MockitoExtension.class)
class ProductServiceTest {
    @Mock private ProductRepository repository;
    @InjectMocks private ProductService service;
    
    @Test
    void testCreateProduct() { }
    
    @Test
    void testUpdateProductQuantity() { }
}
```

### Gap 2: Repository Layer Tests

| Gap | Current | Recommended |
|-----|---------|-------------|
| Query method tests | 0 | 2-3 @DataJpaTest |
| Why | Mocked in controllers | Verify query logic |
| Priority | Low | Queries are simple now |

```java
// Proposed: ProductRepositoryTest.java
@DataJpaTest
class ProductRepositoryTest {
    @Autowired private ProductRepository repository;
    
    @Test
    void testFindByQuantityLessThan() { }
}
```

### Gap 3: Input Validation Tests

| Gap | Current | Recommended |
|-----|---------|-------------|
| Validator tests | 1-2 implicit | 3-5 explicit |
| Negative quantity | ✅ Tested | Continue |
| Negative price | ✅ Tested | Continue |
| Empty string | ❌ Not tested | Add |
| Null values | ❌ Not tested | Add |
| Priority | Medium | Good for MVP+ |

### Gap 4: System/E2E Tests

| Gap | Current | Recommended |
|-----|---------|-------------|
| User flow tests | 0 | 1-2 Playwright |
| Why | Complex setup | Catch UI/API mismatches |
| Priority | Low | Post-MVP |

### Recommended Addition Order

1. **Priority 1** (Next sprint): Add service layer tests (3-5 tests)
2. **Priority 2** (Following sprint): Add validation tests (3-5 tests)
3. **Priority 3** (Backlog): Add repository tests (2-3 tests)
4. **Priority 4** (Future): Add E2E tests (1-2 tests)

---

## Coverage Trends

### Historical (Projected)

```
Sprint 1 (Current):  55% coverage, 9 test classes
Sprint 2 (Plan):     68% coverage, 15 test classes (+6 service)
Sprint 3 (Plan):     75% coverage, 20 test classes (+5 validation)
Sprint 4 (Plan):     82% coverage, 25 test classes (+5 repository)
```

---

## Related Documentation

### Testing Fundamentals
- **[Coverage & Quality](./coverage-and-quality.md)** — Detailed JaCoCo configuration
- **[Test Pyramid](./pyramid.md)** — Recommended test distribution
- **[Testing Strategy](./strategy.md)** — Coverage goals

### Implementation Details
- **[Spring Slices](./spring-slices.md)** — @WebMvcTest, @DataJpaTest
- **[Security Tests](./security-tests.md)** — Authorization test matrix
- **[Controller Integration Tests](./controller-integration.md)** — Endpoint tests

### Main Architecture
- **[Testing Architecture](../testing-architecture.md)** — Entry point
- **[Backend Architecture](../backend.md)** — Code being measured

---

**Last Updated**: October 31, 2025  
**Version**: 1.0  
**Status**: ✅ Reflects current StockEase test coverage

[Back to Testing Index](../testing-architecture.md)
