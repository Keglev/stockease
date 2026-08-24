package com.stocks.stockease.demo.web;

import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.stocks.stockease.demo.ConditionalOnDemoMode;
import com.stocks.stockease.security.JwtUtil;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.UserService;
import com.stocks.stockease.shared.ApiResponse;

import lombok.RequiredArgsConstructor;

/**
 * REST controller issuing a demo session without a password.
 *
 * <p>Passwordless, role-scoped issuance is the demo-access decision of ADR 005: publishing shared
 * credentials on a landing page invites abuse and adds friction, so the demo hands out a token
 * instead. It exists only under {@code app.demo.enabled} and the data behind it is disposable by
 * design - the weekly reset restores the baseline whatever a visitor did with the token.
 *
 * <p>The accounts are real rows created by migration (V10, V15) and carry their roles genuinely, so
 * authorization behaves exactly as it does for any other user. The response is deliberately identical
 * in shape to {@code POST /api/auth/login} - the envelope with the raw JWT as {@code data} - so the
 * frontend reuses its existing auth handling unchanged.
 */
@RestController
@RequestMapping("/api/demo")
@ConditionalOnDemoMode
@RequiredArgsConstructor
public class DemoLoginController {

    /** The demo persona each requested role signs in as; both accounts come from migrations. */
    private static final Map<String, String> DEMO_ACCOUNTS =
            Map.of("ADMIN", "julia.brandt", "USER", "markus.weber");

    private final UserService userService;
    private final JwtUtil jwtUtil;

    /**
     * Issues a signed JWT for the demo account matching the requested role.
     *
     * @param request the requested role, {@code ADMIN} or {@code USER}
     * @return HTTP 200 with the JWT as the envelope's data, or HTTP 400 for an unknown role
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<String>> login(@RequestBody DemoLoginRequest request) {
        String username = request.role() == null ? null : DEMO_ACCOUNTS.get(request.role().toUpperCase(Locale.ROOT));
        if (username == null) {
            // Stays English: no operator reads it. The landing page is the only caller and sends a
            // typed role from one of two buttons, so an unknown role cannot be produced from the
            // UI and this sentence never reaches a screen - it is API prose. The frontend half of
            // this pin is in landing.component.ts.
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse<>(false, "Demo role must be ADMIN or USER.", null));
        }
        User user = userService.findByUsername(username).orElseThrow(() -> new IllegalStateException(
                "Demo user '" + username + "' is missing; it is created by migration, not by seeding."));
        // the role comes off the row, never off the request: the demo ADMIN is an admin because the
        // migration made it one, not because the token says so
        String token = jwtUtil.generateToken(user.getUsername(), user.getRole());
        return ResponseEntity.ok(new ApiResponse<>(true, "Login successful", token));
    }
}
