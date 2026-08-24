package com.stocks.stockease.demo.web;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.stocks.stockease.demo.ConditionalOnDemoMode;
import com.stocks.stockease.demo.DemoDataService;
import com.stocks.stockease.demo.DemoProperties;
import com.stocks.stockease.shared.ApiResponse;

import lombok.RequiredArgsConstructor;

/**
 * REST controller for restoring the demo baseline.
 *
 * <p>Authenticated by a shared token rather than by JWT: the caller is the weekly scheduler, which
 * holds no user account. The endpoint exists only while {@code app.demo.enabled} is true, so a normal
 * deployment has no reset surface to protect at all.
 */
@RestController
@RequestMapping("/api/demo")
@ConditionalOnDemoMode
@RequiredArgsConstructor
public class DemoResetController {

    /** Header carrying the shared reset secret. */
    public static final String RESET_TOKEN_HEADER = "X-Demo-Reset-Token";

    private final DemoDataService demoDataService;
    private final DemoProperties demoProperties;

    /**
     * Wipes the demo database and rebuilds the curated baseline.
     *
     * @param token value of the {@code X-Demo-Reset-Token} header; absent is treated as a mismatch
     * @return HTTP 200 with a completion message, or HTTP 403 if the token does not match
     */
    @PostMapping("/reset")
    public ResponseEntity<ApiResponse<String>> reset(
            @RequestHeader(name = RESET_TOKEN_HEADER, required = false) String token) {
        if (!tokenMatches(token)) {
            // Stays English: no human reads it. The caller is the CI reset workflow holding a shared
            // secret, so this sentence is machine prose - it lands in a workflow log, never on a
            // screen.
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ApiResponse<>(false, "Invalid or missing demo reset token.", null));
        }
        demoDataService.resetToBaseline();
        return ResponseEntity.ok(new ApiResponse<>(true, "Demo data reset to the seeded baseline.", null));
    }

    /**
     * Compares the supplied token against the configured one without leaking its length or content
     * through timing. A blank configured token matches nothing: an unset secret must close the
     * endpoint, never open it.
     */
    private boolean tokenMatches(String token) {
        String expected = demoProperties.resetToken();
        if (token == null || expected == null || expected.isBlank()) {
            return false;
        }
        return MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8),
                expected.getBytes(StandardCharsets.UTF_8));
    }
}
