// all testes passed
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

class AuthControllerTest {

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private AuthController authController;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this); // Initialize mocks
    }

    @Test
    void testLoginSuccess() {

        // Mock data
        String username = "testuser";
        String password = "testpassword";
        String role = "ROLE_USER";
        String token = "mockToken";

        User mockUser = new User(1L, username, password, role);

        // Mocking dependencies
        when(userRepository.findByUsername(username)).thenReturn(Optional.of(mockUser));
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class))).thenReturn(null);
        when(jwtUtil.generateToken(username, role)).thenReturn(token);

        // Login request
        LoginRequest loginRequest = new LoginRequest(username, password);

        // Call the controller and capture response
        ResponseEntity<ApiResponse<String>> responseEntity = authController.login(loginRequest);

        // Assertions
        assertThat(responseEntity).isNotNull(); // Check response entity is not null
        ApiResponse<String> response = responseEntity.getBody();

        // Further assertions after null checks
        if (response != null) {
            assertThat(response.isSuccess()).isTrue();
            assertThat(response.getMessage()).isEqualTo("Login successful");
            assertThat(response.getData()).isEqualTo(token);
        }
    }

    @Test
    void testAdminLoginSuccess() {
        // Mock data
        String username = "adminuser";
        String password = "adminpassword";
        String role = "ROLE_ADMIN";
        String token = "mockAdminToken";

        User mockAdmin = new User(1L, username, password, role);

        // Mocking dependencies
        when(userRepository.findByUsername(username)).thenReturn(Optional.of(mockAdmin));
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class))).thenReturn(null);
        when(jwtUtil.generateToken(username, role)).thenReturn(token);

        // Login request
        LoginRequest loginRequest = new LoginRequest(username, password);

        // Call the controller and capture response
        ResponseEntity<ApiResponse<String>> responseEntity = authController.login(loginRequest);

          // Assertions
          assertThat(responseEntity).isNotNull(); // Check response entity is not null
          ApiResponse<String> response = responseEntity.getBody();
  
          // Further assertions after null checks
          if (response != null) {
              assertThat(response.isSuccess()).isTrue();
              assertThat(response.getMessage()).isEqualTo("Login successful");
            }
    }

    // Test Login with blank username
    @Test
    void testLoginBlankUsername() {
        LoginRequest loginRequest = new LoginRequest("", "password");

        ResponseEntity<ApiResponse<String>> responseEntity = authController.login(loginRequest);

        assertThat(responseEntity.getStatusCode().value()).isEqualTo(400);
    }

    // Test Login with blank password
    @Test
    void testLoginBlankPassword() {
        LoginRequest loginRequest = new LoginRequest("testuser", "");

        ResponseEntity<ApiResponse<String>> responseEntity = authController.login(loginRequest);

        assertThat(responseEntity.getStatusCode().value()).isEqualTo(400);
    }

    // Test Login with Invalid Username
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
            assertThat(response).isNotNull();
            assertThat(response.isSuccess()).isFalse();
            assertThat(response.getMessage()).isEqualTo("User not found");
        }
    }

    // Test Login with Invalid Password
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
            assertThat(response).isNotNull();
            assertThat(response.isSuccess()).isFalse();
            assertThat(response.getMessage()).isEqualTo("Invalid username or password");
        }
    }

    // Test Login with Server Error
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
            assertThat(response).isNotNull();
            assertThat(response.isSuccess()).isFalse();
            assertThat(response.getMessage()).isEqualTo("An unexpected error occurred");
        }
    }

    @Test
    void testLoginInvalidCredentials() {
        String username = "wronguser";
        String password = "wrongpassword";

        // Simulate BadCredentialsException for invalid credentials
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
            .thenThrow(new org.springframework.security.authentication.BadCredentialsException("Invalid credentials"));

        LoginRequest loginRequest = new LoginRequest(username, password);

        ResponseEntity<ApiResponse<String>> responseEntity = authController.login(loginRequest);

        assertThat(responseEntity).isNotNull();
        ApiResponse<String> response = responseEntity.getBody();

        if (response != null) {
            assertThat(response).isNotNull();
            assertThat(response.isSuccess()).isFalse();
            assertThat(response.getMessage()).isEqualTo("Invalid username or password");
        }
    }
}
