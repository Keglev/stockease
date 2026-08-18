package com.stocks.stockease.security;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;

import jakarta.servlet.http.HttpServletResponse;

/**
 * Tests for {@link CustomAccessDeniedHandler} verifying the 403 JSON error response.
 */
class CustomAccessDeniedHandlerTest {

    private final CustomAccessDeniedHandler handler = new CustomAccessDeniedHandler();

    @Test
    void handle_writesForbiddenJsonResponse() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        AccessDeniedException exception = new AccessDeniedException("Access denied");

        handler.handle(request, response, exception);

        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_FORBIDDEN);
        assertThat(response.getContentType()).isEqualTo("application/json");
        assertThat(response.getContentAsString())
                .isEqualTo("{\"success\":false,\"message\":\"You are not authorized to perform this action.\",\"data\":null}");
    }
}
