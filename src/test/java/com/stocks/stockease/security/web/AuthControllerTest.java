package com.stocks.stockease.security.web;

import java.util.Objects;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import com.stocks.stockease.shared.ApiResponse;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.security.JwtUtil;

/** Unit tests for {@link AuthController} login endpoint. */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null") // Objects.requireNonNull() guarantees non-null at runtime; IDE flow analysis does not track it
class AuthControllerTest {

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private AuthController authController;

    @Test
    void login_withValidUserCredentials_returns200() {
        User user = new User(1L, "testuser", "testpassword", "ROLE_USER");
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class))).thenReturn(null);
        when(jwtUtil.generateToken("testuser", "ROLE_USER")).thenReturn("mockToken");

        ResponseEntity<ApiResponse<String>> response = authController.login(buildLoginRequest("testuser", "testpassword"));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(body.isSuccess()).isTrue();
        assertThat(body.getMessage()).isEqualTo("Login successful");
        assertThat(body.getData()).isEqualTo("mockToken");
    }

    @Test
    void login_withValidAdminCredentials_returns200() {
        User admin = new User(1L, "adminuser", "adminpassword", "ROLE_ADMIN");
        when(userRepository.findByUsername("adminuser")).thenReturn(Optional.of(admin));
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class))).thenReturn(null);
        when(jwtUtil.generateToken("adminuser", "ROLE_ADMIN")).thenReturn("mockAdminToken");

        ResponseEntity<ApiResponse<String>> response = authController.login(buildLoginRequest("adminuser", "adminpassword"));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(body.isSuccess()).isTrue();
        assertThat(body.getData()).isEqualTo("mockAdminToken");
    }

    @Test
    void login_withBlankUsername_returns400() {
        ResponseEntity<ApiResponse<String>> response = authController.login(buildLoginRequest("", "password"));

        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void login_withBlankPassword_returns400() {
        ResponseEntity<ApiResponse<String>> response = authController.login(buildLoginRequest("testuser", ""));

        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void login_withNonExistentUsername_returns401() {
        when(userRepository.findByUsername("wronguser")).thenReturn(Optional.empty());
        // auth passes (mocked) but the repo has no record — covers a deleted or externally-removed account
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class))).thenReturn(null);

        ResponseEntity<ApiResponse<String>> response = authController.login(buildLoginRequest("wronguser", "password"));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("User not found");
    }

    @Test
    void login_withBadCredentials_returns401() {
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new BadCredentialsException("Invalid credentials"));

        ResponseEntity<ApiResponse<String>> response = authController.login(buildLoginRequest("testuser", "wrongpassword"));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("Invalid username or password");
    }

    @Test
    void login_whenServerError_returns500() {
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new RuntimeException("Database connection failed"));

        ResponseEntity<ApiResponse<String>> response = authController.login(buildLoginRequest("testuser", "password"));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("An unexpected error occurred");
    }

    private LoginRequest buildLoginRequest(String username, String password) {
        LoginRequest request = new LoginRequest();
        request.setUsername(username);
        request.setPassword(password);
        return request;
    }
}
