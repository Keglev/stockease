package com.stocks.stockease.security;

import java.io.IOException;

import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Handles unauthenticated requests by returning a 401 JSON error response in the {@code ApiResponse} envelope.
 * The message states only that authentication is required, so it neither reveals whether a username exists
 * nor claims wrong credentials for a request that simply carried no token.
 */
@Component
public class CustomAuthenticationEntryPoint implements AuthenticationEntryPoint {

    /**
     * Writes a 401 Unauthorized JSON error response for unauthenticated requests.
     *
     * @param request request that triggered the authentication failure
     * @param response response for writing the error
     * @param authException exception that triggered this entry point
     * @throws IOException if response writing fails
     */
    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        // Generic message prevents username enumeration attacks
        response.getWriter().write("{\"success\":false,\"message\":\"Authentication required.\",\"data\":null}");
    }
}
