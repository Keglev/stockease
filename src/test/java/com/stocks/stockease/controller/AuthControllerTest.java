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
 * Test class for {@link AuthController}.
 * This class contains unit tests for verifying the behavior of the login functionality.
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
     * Sets up the test environment by initializing mocks.
     */
    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    /**
     * Tests successful login for a regular user.
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
     * Tests successful login for an admin user.
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
     * Tests login with a blank username.
     */
    @Test
    void testLoginBlankUsername() {
        LoginRequest loginRequest = new LoginRequest("", "password");

        ResponseEntity<ApiResponse<String>> responseEntity = authController.login(loginRequest);

        assertThat(responseEntity.getStatusCode().value()).isEqualTo(400);
    }

    /**
     * Tests login with a blank password.
     */
    @Test
    void testLoginBlankPassword() {
        LoginRequest loginRequest = new LoginRequest("testuser", "");

        ResponseEntity<ApiResponse<String>> responseEntity = authController.login(loginRequest);

        assertThat(responseEntity.getStatusCode().value()).isEqualTo(400);
    }

    /**
     * Tests login with an invalid username.
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
     * Tests login with an invalid password.
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
     * Tests login when the server encounters an unexpected error.
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
     * Tests login with invalid credentials for both username and password.
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
