package com.stocks.stockease.security.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
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
     *         or an error message on failure (HTTP 401 or 500; a blank field answers 400 from bean
     *         validation, before this method runs)
     * @throws org.springframework.security.authentication.BadCredentialsException
     *         if the password does not match — caught and mapped to HTTP 401
     * @throws UsernameNotFoundException if the account does not exist — mapped to HTTP 401
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<String>> login(@Valid @RequestBody LoginRequest loginRequest) {
        try {
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

        } catch (UsernameNotFoundException | BadCredentialsException e) {
            // One answer for both, down to the sentence: a caller comparing responses cannot tell a
            // wrong password from an account that does not exist. Spring's provider already reports
            // an unknown user as bad credentials, so the lookup above raises this only if that ever
            // stops being true - which is exactly when the fallback must not be the path that says
            // which of the two happened.
            //
            // Stays English: no operator reads it. The frontend login renders its own
            // login.invalidCredentials key on any 401 and never the body's sentence, so this is API
            // prose for whoever calls the endpoint directly.
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse<>(false, "Invalid username or password", null));
        } catch (RuntimeException e) {
            // Stays English on the wire, and carries no code: this is the
            // generic-failure class, and a code would name a situation with
            // nothing specific to say beyond what the sentence already says.
            // What an operator sees is the frontend's own translated generic
            // sentence - resolve() maps any uncoded 5xx to its serverError
            // catalog key - so this prose is for whoever calls the endpoint
            // directly.
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiResponse<>(false, "An unexpected error occurred", null));
        }
    }
}
