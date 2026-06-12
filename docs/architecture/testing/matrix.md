# Coverage Matrix

**Purpose**: Single source of truth for test coverage by layer, feature, and authorization role.

---

## Layer Coverage

| Layer | Classes | Test Classes | Coverage | Status |
|-------|---------|--------------|----------|--------|
| Controller | 2 | 8 | ~85% | Current |
| Security | 2 | Distributed across controller tests | ~75% | Current |
| Config | 1 | 1 (bootstrap) | ~50% | Adequate |
| Model / Entity | 2 | 0 (tested via API responses) | ~30% | Acceptable |
| Repository | 1 | 0 (mocked) | 0% | Intentional |
| Service | 0 | 0 (mocked) | 0% | Future |

---

## Endpoint Coverage

| Endpoint | Method | Test Class | Type | Status |
|----------|--------|------------|------|--------|
| `/api/auth/login` | POST | `AuthControllerTest` | Unit | Done |
| `/api/products` | GET | `ProductFetchControllerTest` | Slice | Done |
| `/api/products/{id}` | GET | `ProductFetchControllerTest` | Slice | Done |
| `/api/products/low-stock` | GET | `ProductControllerTest` | Slice | Done |
| `/api/products` | POST | `ProductCreateControllerTest` | Slice | Done |
| `/api/products/{id}` | PUT | `ProductUpdateControllerTest` | Slice | Done |
| `/api/products/{id}` | DELETE | `ProductDeleteControllerTest` | Slice | Done |
| `/api/products?page&size` | GET | `ProductPaginationControllerTest` | Slice | Done |

---

## Authorization Matrix

| Endpoint | Method | ADMIN | USER | Anonymous |
|----------|--------|-------|------|-----------|
| `/api/products` | GET | 200 | 200 | 401 |
| `/api/products/{id}` | GET | 200 | 200 | 401 |
| `/api/products/low-stock` | GET | 200 | 200 | 401 |
| `/api/products` | POST | 200 | 403 | 401 |
| `/api/products/{id}` | PUT | 200 | 403 | 401 |
| `/api/products/{id}` | DELETE | 204 | 403 | 401 |

All cells above are covered by existing tests.

---

## Test Method Inventory

### AuthControllerTest (Unit)
- `testLoginSuccess`
- `testAdminLoginSuccess`
- `testLoginFailureWithInvalidCredentials`
- `testLoginFailureWithUserNotFound`

### ProductControllerTest (Slice)
- `testGetProductsSuccess`
- `testLowStockProductsWithRoles` *(parameterized: ADMIN, USER)*
- `testLowStockProductsEmptyWithRoles` *(parameterized: ADMIN, USER)*

### ProductFetchControllerTest (Slice)
- `testGetAllProducts`
- `testGetProductByIdSuccess`
- `testGetProductByIdNotFound`

### ProductCreateControllerTest (Slice)
- `testValidProductCreation`
- `testProductCreationDeniedForUser`
- `testProductCreationWithoutAuth`

### ProductUpdateControllerTest (Slice)
- `testValidProductUpdate`
- `testProductUpdateQuantity`
- `testProductUpdateDeniedForUser`

### ProductInvalidUpdateControllerTest (Slice)
- `testInvalidUpdateNegativeQuantity`
- `testInvalidUpdateNegativePrice`

### ProductDeleteControllerTest (Slice)
- `testDeleteProductSuccess`
- `testDeleteProductDeniedForUser`

### ProductPaginationControllerTest (Slice)
- `testPaginationWithValidParams`
- `testPaginationWithInvalidParams`

### StockEaseApplicationTests (Integration)
- `contextLoads`

---

## Coverage Gaps

| Gap | Priority | Action |
|-----|----------|--------|
| Service layer — no unit tests | Medium | Add `@ExtendWith(MockitoExtension)` service tests |
| Input validation — empty name, null fields | Medium | Add explicit validation tests |
| Repository queries — no `@DataJpaTest` | Low | Add when queries become complex |
| JWT expiry and token tampering | Low | Add when security hardening is prioritized |
| E2E user flows | Future | Out of scope for this repo |

---

## Related Documentation

- **[Testing Strategy](./strategy.md)** — Goals and scope
- **[Test Pyramid](./pyramid.md)** — Distribution rationale
- **[Coverage & Quality](./coverage-and-quality.md)** — JaCoCo configuration and thresholds

---

**Last Updated**: June 2026
**Status**: Current

[Back to Testing Architecture Index](testing-architecture.md)