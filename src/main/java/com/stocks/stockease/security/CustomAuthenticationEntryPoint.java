package com.stocks.stockease.security;

import java.io.IOException;

import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Custom implementation of Spring Security's {@link AuthenticationEntryPoint}.
 * This class handles unauthorized access attempts by returning a custom error response.
 */
@Component
public class CustomAuthenticationEntryPoint implements AuthenticationEntryPoint {

    /**
     * Handles unauthorized access by returning a 401 (Unauthorized) response with a JSON error message.
     * 
     * @param request the HttpServletRequest that resulted in an AuthenticationException
     * @param response the HttpServletResponse to send the error response
     * @param authException the exception thrown when authentication fails
     * @throws IOException if an input or output error occurs while writing the response
     */
    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED); // Set HTTP status to 401
        response.setContentType("application/json"); // Set content type to JSON
        response.getWriter().write("{\"error\": \"Invalid username or password\"}"); // Write custom error message
    }
}
