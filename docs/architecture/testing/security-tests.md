# Security Tests

**Purpose**: Document how authentication and authorization are tested in StockEase.

---

## Security Test Scope

| Layer | What | How | Status |
|-------|------|-----|--------|
| JWT Generation | Token created on login | `AuthControllerTest` | Done |
| JWT Validation | Token accepted by filter | MockMvc with mocked `JwtUtil` | Done |
| Role enforcement | ADMIN vs USER access | MockMvc with `.roles()` | Done |
| Anonymous access | No token → 401 | MockMvc without auth | Done |
| CSRF | Token required on mutations | `.with(csrf())` | Done |
| Token expiry | Expired token → 401 | Not yet tested | Future |
| Token tampering | Modified token → 401 | Not yet tested | Future |

---

## JWT Authentication Tests

### Login Returns JWT

```java
@Test
void testLoginSuccess() {
    // Given
    User mockUser = new User(1L, "testuser", "password", "ROLE_USER");
    when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(mockUser));
    when(authenticationManager.authenticate(any())).thenReturn(null);
    when(jwtUtil.generateToken("testuser", "ROLE_USER")).thenReturn("mockToken");

    // When
    ResponseEntity<ApiResponse<String>> response =
        authController.login(new LoginRequest("testuser", "password"));

    // Then
    assertThat(response.getBody().isSuccess()).isTrue();
    assertThat(response.getBody().getData()).isEqualTo("mockToken");
}
```

### Login Fails — Invalid Credentials

```java
@Test
void testLoginFailureWithInvalidCredentials() {
    when(authenticationManager.authenticate(any()))
        .thenThrow(new BadCredentialsException("Bad credentials"));

    ResponseEntity<ApiResponse<String>> response =
        authController.login(new LoginRequest("user", "wrongpassword"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    assertThat(response.getBody().isSuccess()).isFalse();
}
```

---

## Role-Based Access Control Tests

### Admin Allowed, User Forbidden

```java
@Test
void testProductCreationDeniedForUser() throws Exception {
    mockMvc.perform(post("/api/products")
        .contentType(APPLICATION_JSON)
        .content("{\"name\": \"Product\", \"quantity\": 10, \"price\": 100.0}")
        .with(csrf())
        .with(user("regularUser").roles("USER")))
        .andExpect(status().isForbidden());
}

@Test
void testProductCreationWithoutAuth() throws Exception {
    mockMvc.perform(post("/api/products")
        .contentType(APPLICATION_JSON)
        .content("{\"name\": \"Product\", \"quantity\": 10, \"price\": 100.0}")
        .with(csrf()))
        .andExpect(status().isUnauthorized());
}
```

### Both Roles Allowed (Parameterized)

```java
@ParameterizedTest
@CsvSource({"adminUser, ADMIN", "regularUser, USER"})
void testLowStockProductsWithRoles(String username, String role) throws Exception {
    when(productRepository.findByQuantityLessThan(5))
        .thenReturn(Arrays.asList(lowStockProduct));

    mockMvc.perform(get("/api/products/low-stock")
        .with(SecurityMockMvcRequestPostProcessors.user(username).roles(role)))
        .andExpect(status().isOk());
}
```

---

## CSRF in Tests

CSRF protection is active in `@WebMvcTest`. All POST, PUT, and DELETE requests require `.with(csrf())`.

```java
// Missing csrf() → 403 even with correct role
mockMvc.perform(post("/api/products")
    .with(user("admin").roles("ADMIN")))  // No csrf → 403
    .andExpect(status().isForbidden());

// Correct
mockMvc.perform(post("/api/products")
    .with(csrf())
    .with(user("admin").roles("ADMIN")))
    .andExpect(status().isOk());
```

---

## Security Anti-Patterns

**Disabling security filters** — `@AutoConfigureMockMvc(addFilters = false)` skips the entire security layer. Tests pass but nothing is verified. Use `.with(user(...))` instead.

**Real JWT tokens in tests** — hardcoded tokens are fragile and environment-dependent. Mock `JwtUtil.validateToken()` to return `true` for all tokens in tests.

**Only testing the happy path** — every secured endpoint must have three tests: admin allowed, user forbidden, anonymous unauthorized.

---

## Related Documentation

- **[Spring Slices](./spring-slices.md)** — How `@WebMvcTest` loads security
- **[Controller Integration Tests](./controller-integration.md)** — MockMvc request patterns
- **[Coverage Matrix](./matrix.md)** — Full authorization matrix
- **[Troubleshooting](./troubleshooting.md)** — Auth-related test errors

---

**Last Updated**: June 2026
**Status**: Current

[Back to Testing Architecture Index](testing-architecture.md)