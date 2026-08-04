package com.stocks.stockease.demo.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.stocks.stockease.demo.DemoDataService;
import com.stocks.stockease.demo.DemoProperties;
import com.stocks.stockease.shared.ApiResponse;

/**
 * Pins what an unconfigured secret does to the reset endpoint.
 *
 * <p>Direct construction rather than {@code @SpringBootTest}: the branches under test are decided by
 * the configured token being absent, and a token that is absent for the whole context is a different
 * context - two more of them, for two lines. {@link com.stocks.stockease.demo.DemoResetIntegrationTest}
 * already proves the endpoint, its wiring and its 403 against a live application; what is left here is
 * only the comparison's own reading of a missing secret.
 */
class DemoResetControllerTest {

    private final DemoDataService demoDataService = mock(DemoDataService.class);

    private ResponseEntity<ApiResponse<String>> reset(String configured, String supplied) {
        DemoResetController controller =
                new DemoResetController(demoDataService, new DemoProperties(true, configured));
        return controller.reset(supplied);
    }

    @Test
    void reset_withUnsetToken_returns403AndWipesNothing() {
        // an unset secret must close the endpoint, never open it: no configured value means no caller
        // can match it, not that every caller matches it
        ResponseEntity<ApiResponse<String>> response = reset(null, "test-demo-reset-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody().getMessage()).isEqualTo("Invalid or missing demo reset token.");
        verify(demoDataService, never()).resetToBaseline();
    }

    @Test
    void reset_withBlankToken_returns403EvenWhenTheCallerSuppliesIt() {
        // the caller sends exactly what is configured, so only the blank check stands between a blank
        // secret and a full wipe - a byte comparison alone would let this through
        ResponseEntity<ApiResponse<String>> response = reset("   ", "   ");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody().getMessage()).isEqualTo("Invalid or missing demo reset token.");
        verify(demoDataService, never()).resetToBaseline();
    }
}
