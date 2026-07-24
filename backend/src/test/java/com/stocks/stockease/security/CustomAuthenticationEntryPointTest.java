package com.stocks.stockease.security;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.AuthenticationException;

import jakarta.servlet.http.HttpServletResponse;

/**
 * Tests for {@link CustomAuthenticationEntryPoint} verifying the 401 JSON error response.
 */
class CustomAuthenticationEntryPointTest {

    private final CustomAuthenticationEntryPoint entryPoint = new CustomAuthenticationEntryPoint();

    @Test
    void commence_writesUnauthorizedJsonResponse() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        AuthenticationException exception = new AuthenticationException("Unauthorized") {};

        entryPoint.commence(request, response, exception);

        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
        assertThat(response.getContentType()).isEqualTo("application/json");
        assertThat(response.getContentAsString())
                .isEqualTo("{\"error\": \"Invalid username or password\"}");
    }
}
