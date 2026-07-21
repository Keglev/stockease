package com.stocks.stockease.security.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.stocks.stockease.shared.ApiResponse;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.security.JwtUtil;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * REST controller for user authentication.
 *
 * <p>Exposes a single login endpoint that validates credentials via Spring Security
 * and issues a signed JWT for subsequent API requests. Contract defined in
 * {@code docs/api/paths/auth-login.yaml}.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    /**
     * Authenticates the supplied credentials and returns a signed JWT.
     *
     * <p>Behavior is defined in {@code docs/api/paths/auth-login.yaml},
     * operation {@code loginUser}.
     *
     * @param loginRequest username and password payload
     * @return {@link ApiResponse} wrapping the JWT string on success (HTTP 200),
     *         or an error message on failure (HTTP 400, 401, or 500)
     * @throws org.springframework.security.authentication.BadCredentialsException
     *         if the password does not match — caught and mapped to HTTP 401
     * @throws UsernameNotFoundException if the account does not exist — mapped to HTTP 401
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<String>> login(@Valid @RequestBody LoginRequest loginRequest) {
        try {
            if (loginRequest.getUsername().isBlank() || loginRequest.getPassword().isBlank()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse<>(false, "Username and password cannot be blank", null));
            }

            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                    loginRequest.getUsername(),
                    loginRequest.getPassword()
                )
            );

            User user = userRepository.findByUsername(loginRequest.getUsername())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

            String token = jwtUtil.generateToken(user.getUsername(), user.getRole());
            return ResponseEntity.ok(new ApiResponse<>(true, "Login successful", token));

        } catch (UsernameNotFoundException e) {
            // Generic message prevents user enumeration (do not reveal whether the username exists)
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse<>(false, e.getMessage(), null));
        } catch (org.springframework.security.authentication.BadCredentialsException e) {
            // Generic message prevents user enumeration (do not reveal which field was wrong)
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse<>(false, "Invalid username or password", null));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiResponse<>(false, "An unexpected error occurred", null));
        }
    }
}
