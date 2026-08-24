package com.stocks.stockease.security;

import java.io.IOException;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Handles authorization failures raised in the security filter chain by returning a 403 JSON error
 * response in the {@code ApiResponse} envelope.
 *
 * <p>The envelope is the error contract: every client reads {@code message} for the sentence to show
 * and treats its absence as nothing to say. A body of a different shape is not a smaller answer, it
 * is an unreadable one - the frontend interceptor finds no message and substitutes its own generic
 * text, so whatever the server wrote never reaches the operator.
 *
 * <p>This path is latent rather than live, and the chain is what makes it so. Its authorization
 * rules are, in full: {@code permitAll} on the health endpoints, on the login POST and on whatever
 * public endpoints an active module contributes, then a blanket {@code anyRequest().authenticated()}.
 * There is not one role rule among them, and CSRF is disabled, so no authorization decision the
 * chain makes can raise {@code AccessDeniedException} on any path this build serves. Role decisions
 * live on {@code @PreAuthorize} inside the dispatcher instead, where {@code GlobalExceptionHandler}
 * answers them with an envelope of its own.
 *
 * <p>So this handler fires only if that arrangement changes - a role rule moved into the chain, a
 * filter added ahead of the dispatcher. It exists in envelope shape for that day: a fallback nobody
 * exercises is exactly the one that must fail into the contract rather than out of it, because there
 * will be no test failing to say otherwise.
 */
@Component
public class CustomAccessDeniedHandler implements AccessDeniedHandler {

    /**
     * Writes a 403 Forbidden JSON error response for authenticated requests lacking the required
     * authority.
     *
     * @param request request that triggered the authorization failure
     * @param response response for writing the error
     * @param accessDeniedException exception that triggered this handler
     * @throws IOException if response writing fails
     */
    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter()
                .write("{\"success\":false,\"message\":\"You are not authorized to perform this action.\",\"data\":null}");
    }
}
