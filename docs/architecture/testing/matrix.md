# Coverage Matrix

**Purpose**: Single source of truth for test coverage by layer, feature, and authorization role.

---

## Layer Coverage

| Layer | Classes | Test Classes | Coverage | Status |
|-------|---------|--------------|----------|--------|
| Controller | 3 | 9 | ~85% | Current |
| Security | 4 | 4 dedicated test classes | ~90% | Current |
| Exception | 1 | 1 (GlobalExceptionHandlerTest) | ~90% | Current |
| Config | 3+ | 2 (DataSeederTest, FlywayConfigurationTest) | ~65% | Current |
| Model / Entity | 2 | 1 (ProductTest) | ~55% | Current |
| Repository | 1 | 0 (mocked) | 0% | Intentional |

---

## Endpoint Coverage

| Endpoint | Method | Test Class | Type | Status |
|----------|--------|------------|------|--------|
| `/api/auth/login` | POST | `AuthControllerTest` | Unit | Done |
| `/api/products` | GET | `ProductFetchControllerTest` | Slice | Done |
| `/api/products/{id}` | GET | `ProductFetchControllerTest` | Slice | Done |
| `/api/products/low-stock` | GET | `ProductControllerTest` | Slice | Done |
| `/api/products/search` | GET | `ProductControllerTest` | Slice | Done |
| `/api/products/total-stock-value` | GET | `ProductControllerTest` | Slice | Done |
| `/api/products/paged` | GET | `ProductPaginationControllerTest` | Slice | Done |
| `/api/products` | POST | `ProductCreateControllerTest` | Slice | Done |
| `/api/products/{id}/quantity` | PUT | `ProductUpdateControllerTest`, `ProductInvalidUpdateControllerTest` | Slice | Done |
| `/api/products/{id}/price` | PUT | `ProductUpdateControllerTest`, `ProductInvalidUpdateControllerTest` | Slice | Done |
| `/api/products/{id}/name` | PUT | `ProductUpdateControllerTest`, `ProductInvalidUpdateControllerTest` | Slice | Done |
| `/api/products/{id}` | DELETE | `ProductDeleteControllerTest` | Slice | Done |
| `/health` | GET | `HealthControllerTest` | Unit | Done |

---

## Authorization Matrix

| Endpoint | Method | ADMIN | USER | Anonymous |
|----------|--------|-------|------|-----------|
| `/api/products` | GET | 200 | 200 | 401 |
| `/api/products/{id}` | GET | 200 | 200 | 401 |
| `/api/products/low-stock` | GET | 200 | 200 | 401 |
| `/api/products/search` | GET | 200 | 200 | 401 |
| `/api/products/total-stock-value` | GET | 200 | 200 | 401 |
| `/api/products/paged` | GET | 200 | 200 | 401 |
| `/api/products` | POST | 200 | 403 | 401 |
| `/api/products/{id}/quantity` | PUT | 200 | 200 | 401 |
| `/api/products/{id}/price` | PUT | 200 | 200 | 401 |
| `/api/products/{id}/name` | PUT | 200 | 200 | 401 |
| `/api/products/{id}` | DELETE | 200 | 403 | 401 |

All cells above are covered by existing tests.

---

## Test Method Inventory

### AuthControllerTest (Unit)
- `login_withValidUserCredentials_returns200`
- `login_withValidAdminCredentials_returns200`
- `login_withBlankUsername_returns400`
- `login_withBlankPassword_returns400`
- `login_withNonExistentUsername_returns401`
- `login_withBadCredentials_returns401`
- `login_whenServerError_returns500`

### ProductControllerTest (Slice)
- `getLowStockProducts_withLowStockItems_returnsProducts` *(parameterized: ADMIN, USER)*
- `getLowStockProducts_withNoLowStockItems_returnsAllStockedMessage` *(parameterized: ADMIN, USER)*
- `searchProducts_withMatchingName_returnsProducts` *(parameterized: ADMIN, USER)*
- `searchProducts_withNoMatches_returns204` *(parameterized: ADMIN, USER)*
- `getTotalStockValue_withProducts_returnsCalculatedValue` *(parameterized: ADMIN, USER)*
- `getTotalStockValue_withNoProducts_returnsZero` *(parameterized: ADMIN, USER)*

### ProductFetchControllerTest (Slice)
- `contextLoads_onApplicationStart_beansAreInjected`
- `getAllProducts_withAdminOrUserRole_returns200` *(parameterized: ADMIN, USER)*
- `getProductById_withExistingId_returns200` *(parameterized: ADMIN, USER)*
- `getProductById_withNonExistentId_returns404` *(parameterized: ADMIN, USER)*

### ProductCreateControllerTest (Slice)
- `createProduct_withValidData_returns200`
- `createProduct_asUserRole_returns403`
- `createProduct_withMissingName_returns400`
- `createProduct_withNegativeQuantity_returns400`
- `createProduct_withZeroPrice_returns400`
- `createProduct_withInvalidPriceType_returns400`

### ProductUpdateControllerTest (Slice)
- `updateQuantity_withValidData_returns200` *(parameterized: ADMIN, USER)*
- `updatePrice_withValidData_returns200` *(parameterized: ADMIN, USER)*
- `updateName_withSpecialCharacters_returns200` *(parameterized: ADMIN, USER)*

### ProductInvalidUpdateControllerTest (Slice)
- `updateQuantity_withMissingField_returns400` *(parameterized: ADMIN, USER)*
- `updateQuantity_withInvalidType_returns400` *(parameterized: ADMIN, USER)*
- `updatePrice_withNegativeValue_returns400` *(parameterized: ADMIN, USER)*
- `updatePrice_withInvalidType_returns400` *(parameterized: ADMIN, USER)*
- `updatePrice_withZeroValue_returns400` *(parameterized: ADMIN, USER)*
- `updateName_withWhitespaceOnly_returns400` *(parameterized: ADMIN, USER)*
- `updateProduct_whenNotFound_returns404` *(parameterized: ADMIN, USER)*
- `updateProduct_withoutCsrfToken_returns403` *(parameterized: ADMIN, USER)*

### ProductDeleteControllerTest (Slice)
- `deleteProduct_asAdmin_returns200`
- `deleteProduct_whenProductNotFound_returns404`
- `deleteProduct_asUserRole_returns403`

### ProductPaginationControllerTest (Slice)
- `getProductsPaged_withValidParams_returns200` *(parameterized: ADMIN, USER)*
- `getProductsPaged_withEmptyPage_returnsEmptyContent` *(parameterized: ADMIN, USER)*
- `getProductsPaged_withNegativeParams_returns400` *(parameterized: ADMIN, USER)*

### StockEaseApplicationTests (Integration)
- `contextLoads_withTestProfile_applicationStartsSuccessfully`

### HealthControllerTest (Unit)
- `healthCheck_whenConnectionIsValid_returns200`
- `healthCheck_whenConnectionIsNotValid_returns500WithUnknownMessage`
- `healthCheck_whenGetConnectionThrowsSQLException_returns500WithErrorMessage`

### GlobalExceptionHandlerTest (Unit)
- `handleNoSuchElementException_returns404WithExceptionMessage`
- `handleEntityNotFoundException_returns404WithExceptionMessage`
- `handleJwtException_returns401`
- `handleBadCredentialsException_returns401`
- `handleAccessDeniedException_returns403`
- `handleIllegalArgumentException_returns400WithOriginalMessage`
- `handleValidationException_returns400WithFieldErrors`
- `handleHttpMessageNotReadableException_withNullMessage_returnsDefaultMessage`
- `handleHttpMessageNotReadableException_withGenericError_returnsDefaultMessage`
- `handleHttpMessageNotReadableException_withDeserializeError_returnsSpecificMessage`
- `handleHandlerMethodValidationException_withConstraintViolationCause_returns400WithViolationDetails`
- `handleHandlerMethodValidationException_withBindExceptionCause_returns400WithFieldErrors`
- `handleHandlerMethodValidationException_withUnknownCause_returns400WithUnknownKey`
- `handleGeneralException_returns500`

### DataSeederTest (Unit)
- `seedData_whenUsersAndProductsAlreadyExist_skipsAllInsertions`

### FlywayConfigurationTest (Unit)
- `flyway_whenFlywayDisabled_returnsFlywayInstanceWithoutMigrating`

### ProductTest (Unit)
- `setQuantity_withNullQuantity_setsTotalValueToZero`
- `setPrice_withNullPrice_setsTotalValueToZero`

### JwtUtilTest (Unit)
- `generateToken_returnsCompactJwtString`
- `generateToken_embeddedClaimsMatchInputs`
- `validateToken_withValidToken_returnsTrue`
- `validateToken_withMalformedToken_returnsFalse`
- `validateToken_withExpiredToken_returnsFalse`
- `extractUsername_returnsCorrectSubjectClaim`
- `extractRole_returnsCorrectRoleClaim`
- `extractClaim_withCustomResolver_returnsExpectedValue`

### JwtFilterTest (Unit)
- `doFilterInternal_withNoAuthorizationHeader_doesNotSetAuthentication`
- `doFilterInternal_withNonBearerAuthorizationHeader_doesNotSetAuthentication`
- `doFilterInternal_withValidBearerToken_populatesSecurityContext`
- `doFilterInternal_withInvalidBearerToken_doesNotSetAuthentication`

### CustomUserDetailsServiceTest (Unit)
- `loadUserByUsername_withExistingUser_returnsUserDetailsWithCorrectFields`
- `loadUserByUsername_withAdminUser_returnsAdminAuthority`
- `loadUserByUsername_withUnknownUsername_throwsUsernameNotFoundException`

### CustomAuthenticationEntryPointTest (Unit)
- `commence_writesUnauthorizedJsonResponse`

---

## Coverage Gaps

| Gap | Priority | Action |
|-----|----------|--------|
| Repository queries — no `@DataJpaTest` | Low | Add when queries become complex |
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