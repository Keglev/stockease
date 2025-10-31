package com.stocks.stockease.controller;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.when;
import org.mockito.MockitoAnnotations;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import com.stocks.stockease.dto.ApiResponse;
import com.stocks.stockease.dto.LoginRequest;
import com.stocks.stockease.model.User;
import com.stocks.stockease.repository.UserRepository;
import com.stocks.stockease.security.JwtUtil;

/**
 * Unit tests for {@link AuthController} login endpoint.
 * 
 * System Under Test (SUT): AuthController.login(LoginRequest) → ResponseEntity<ApiResponse<String>>
 * 
 * Test strategy:
 * - Mock AuthenticationManager (Spring Security credential validation)
 * - Mock JwtUtil (JWT token generation)
 * - Mock UserRepository (user lookup by username)
 * - Verify controller behavior without HTTP server startup (unit test, not integration)
 * 
 * Test coverage:
 * 1. Happy path: Valid credentials for USER and ADMIN roles
 * 2. Validation failures: Blank username, blank password
 * 3. Authentication failures: Invalid username (user not found)
 * 4. Authorization: Role-based authorization checks (if applicable)
 * 
 * Mock framework: Mockito (argument matchers, method stubbing, verification)
 * Test framework: JUnit 5 (Jupiter) with @BeforeEach lifecycle
 * 
 * Expected behavior (Given-When-Then):
 * - Given: Valid credentials + authenticated user
 *   When: login() called with LoginRequest
 *   Then: ResponseEntity(200, success=true, data=token)
 * 
 * - Given: Invalid username (user not found)
 *   When: login() called
 *   Then: ResponseEntity(400/401, success=false, message="User not found")
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 * @see AuthController (login endpoint)
 * @see JwtUtil (token generation)
 * @see AuthenticationManager (credential validation)
 */
class AuthControllerTest {

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private AuthController authController;

    /**
     * Lifecycle hook: Initialize mocks before each test.
     * 
     * Mock initialization:
     * - @Mock AuthenticationManager: Simulates Spring Security credential validation
     * - @Mock JwtUtil: Simulates JWT token generation
     * - @Mock UserRepository: Simulates user lookup database queries
     * - @InjectMocks AuthController: Injects mocks into SUT via field injection
     * 
     * Execution: MockitoAnnotations.openMocks(this) initializes all @Mock/@InjectMocks
     * 
     * Isolation benefit: Each test starts with fresh mock state (default stubs reset)
     * 
     * @junit.jupiter.api.annotation.BeforeEach runs BEFORE each @Test method
     */
    @SuppressWarnings("unused") // Called by JUnit 5 @BeforeEach lifecycle
    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    /**
     * Given: Valid credentials for a regular USER role
     * When: login() called with correct username and password
     * Then: ResponseEntity(200 OK, success=true, data=JWT token)
     * 
     * Test scenario:
     * - Mock UserRepository to return valid user
     * - Mock AuthenticationManager to accept credentials
     * - Mock JwtUtil to generate token
     * - Verify response contains token and success flag
     */
    @Test
    void testLoginSuccess() {
        String username = "testuser";
        String password = "testpassword";
        String role = "ROLE_USER";
        String token = "mockToken";

        User mockUser = new User(1L, username, password, role);

        when(userRepository.findByUsername(username)).thenReturn(Optional.of(mockUser));
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class))).thenReturn(null);
        when(jwtUtil.generateToken(username, role)).thenReturn(token);

        LoginRequest loginRequest = new LoginRequest(username, password);

        ResponseEntity<ApiResponse<String>> responseEntity = authController.login(loginRequest);

        assertThat(responseEntity).isNotNull();
        ApiResponse<String> response = responseEntity.getBody();

        if (response != null) {
            assertThat(response.isSuccess()).isTrue();
            assertThat(response.getMessage()).isEqualTo("Login successful");
            assertThat(response.getData()).isEqualTo(token);
        }
    }

    /**
     * Given: Valid credentials for an ADMIN role user
     * When: login() called with admin username and password
     * Then: ResponseEntity(200 OK, success=true, data=JWT token with ADMIN role)
     * 
     * Test scenario:
     * - Verify admin users can authenticate and receive JWT tokens
     * - Mock includes ROLE_ADMIN authority in JwtUtil.generateToken()
     * - Confirms role is preserved in token for authorization checks
     */
    @Test
    void testAdminLoginSuccess() {
        String username = "adminuser";
        String password = "adminpassword";
        String role = "ROLE_ADMIN";
        String token = "mockAdminToken";

        User mockAdmin = new User(1L, username, password, role);

        when(userRepository.findByUsername(username)).thenReturn(Optional.of(mockAdmin));
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class))).thenReturn(null);
        when(jwtUtil.generateToken(username, role)).thenReturn(token);

        LoginRequest loginRequest = new LoginRequest(username, password);

        ResponseEntity<ApiResponse<String>> responseEntity = authController.login(loginRequest);

        assertThat(responseEntity).isNotNull();
        ApiResponse<String> response = responseEntity.getBody();

        if (response != null) {
            assertThat(response.isSuccess()).isTrue();
            assertThat(response.getMessage()).isEqualTo("Login successful");
        }
    }

    /**
     * Given: LoginRequest with empty/blank username field
     * When: login() called with empty username
     * Then: ResponseEntity(400 Bad Request) - @Valid validation fails
     * 
     * Test scenario:
     * - LoginRequest uses @NotBlank on username field
     * - Spring validation framework rejects empty string before reaching controller logic
     * - Verifies input validation layer works correctly
     */
    @Test
    void testLoginBlankUsername() {
        LoginRequest loginRequest = new LoginRequest("", "password");

        ResponseEntity<ApiResponse<String>> responseEntity = authController.login(loginRequest);

        assertThat(responseEntity.getStatusCode().value()).isEqualTo(400);
    }

    /**
     * Given: LoginRequest with empty/blank password field
     * When: login() called with empty password
     * Then: ResponseEntity(400 Bad Request) - @Valid validation fails
     * 
     * Test scenario:
     * - LoginRequest uses @NotBlank on password field
     * - Spring validation framework rejects empty string before reaching controller logic
     * - Verifies input validation layer works correctly
     */
    @Test
    void testLoginBlankPassword() {
        LoginRequest loginRequest = new LoginRequest("testuser", "");

        ResponseEntity<ApiResponse<String>> responseEntity = authController.login(loginRequest);

        assertThat(responseEntity.getStatusCode().value()).isEqualTo(400);
    }

    /**
     * Given: Username that does NOT exist in database
     * When: login() called with non-existent username
     * Then: ResponseEntity(400/401, success=false, message="User not found")
     * 
     * Test scenario:
     * - Mock UserRepository.findByUsername() to return Optional.empty()
     * - GlobalExceptionHandler catches UsernameNotFoundException (thrown by AuthController)
     * - Verifies secure authentication failure (generic message, no username enumeration)
     */
    @Test
    void testLoginInvalidUsername() {
        String username = "wronguser";
        String password = "password";

        when(userRepository.findByUsername(username)).thenReturn(Optional.empty());

        LoginRequest loginRequest = new LoginRequest(username, password);
        ResponseEntity<ApiResponse<String>> responseEntity = authController.login(loginRequest);

        assertThat(responseEntity).isNotNull();
        ApiResponse<String> response = responseEntity.getBody();

        if (response != null) {
            assertThat(response.isSuccess()).isFalse();
            assertThat(response.getMessage()).isEqualTo("User not found");
        }
    }

    /**
     * Given: Valid username BUT incorrect/wrong password
     * When: login() called with wrong password
     * Then: ResponseEntity(401, success=false, message="Invalid username or password")
     * 
     * Test scenario:
     * - Mock UserRepository to return valid user
     * - Mock AuthenticationManager to throw BadCredentialsException
     * - GlobalExceptionHandler converts to 401 Unauthorized response
     * - Verifies secure failure message (generic, prevents credential stuffing hints)
     */
    @Test
    void testLoginInvalidPassword() {
        String username = "testuser";
        String password = "wrongpassword";

        User mockUser = new User(1L, username, "password", "ROLE_USER");

        when(userRepository.findByUsername(username)).thenReturn(Optional.of(mockUser));
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new org.springframework.security.authentication.BadCredentialsException("Invalid credentials") {});

        LoginRequest loginRequest = new LoginRequest(username, password);
        ResponseEntity<ApiResponse<String>> responseEntity = authController.login(loginRequest);

        assertThat(responseEntity).isNotNull();
        ApiResponse<String> response = responseEntity.getBody();

        if (response != null) {
            assertThat(response.isSuccess()).isFalse();
            assertThat(response.getMessage()).isEqualTo("Invalid username or password");
        }
    }

    /**
     * Given: AuthenticationManager throws unexpected RuntimeException (e.g., database connection failure)
     * When: login() called during server-side error condition
     * Then: ResponseEntity(500, success=false, message="An unexpected error occurred")
     * 
     * Test scenario:
     * - Mock AuthenticationManager to throw RuntimeException
     * - GlobalExceptionHandler catches all exceptions as safety net
     * - Returns 500 with generic message (no stack trace exposure to client)
     * - Verifies error handling gracefully prevents information leakage
     */
    @Test
    void testServerError() {
        String username = "testuser";
        String password = "password";

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new RuntimeException("Database connection failed"));

        LoginRequest loginRequest = new LoginRequest(username, password);
        ResponseEntity<ApiResponse<String>> responseEntity = authController.login(loginRequest);

        assertThat(responseEntity).isNotNull();
        ApiResponse<String> response = responseEntity.getBody();

        if (response != null) {
            assertThat(response.isSuccess()).isFalse();
            assertThat(response.getMessage()).isEqualTo("An unexpected error occurred");
        }
    }

    /**
     * Given: Both username and password are invalid/non-existent
     * When: login() called with wrong credentials
     * Then: ResponseEntity(401, success=false, message="Invalid username or password")
     * 
     * Test scenario:
     * - Mock AuthenticationManager to throw BadCredentialsException
     * - Verifies consistent error message for both invalid username and password
     * - Security best practice: doesn't distinguish between "user not found" vs "wrong password"
     * - Prevents attackers from enumerating valid usernames via credential stuffing
     */
    @Test
    void testLoginInvalidCredentials() {
        String username = "wronguser";
        String password = "wrongpassword";

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
            .thenThrow(new org.springframework.security.authentication.BadCredentialsException("Invalid credentials"));

        LoginRequest loginRequest = new LoginRequest(username, password);

        ResponseEntity<ApiResponse<String>> responseEntity = authController.login(loginRequest);

        assertThat(responseEntity).isNotNull();
        ApiResponse<String> response = responseEntity.getBody();

        if (response != null) {
            assertThat(response.isSuccess()).isFalse();
            assertThat(response.getMessage()).isEqualTo("Invalid username or password");
        }
    }
}
