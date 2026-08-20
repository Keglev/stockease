package com.stocks.stockease.shared.web;

import com.stocks.stockease.shared.ApiErrorCodes;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.NoSuchElementException;
import java.util.Objects;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;

import com.stocks.stockease.shared.ApiResponse;
import com.stocks.stockease.shared.DuplicateResourceException;
import com.stocks.stockease.shared.EntityInUseException;
import com.stocks.stockease.shared.InsufficientStockException;
import com.stocks.stockease.shared.InvalidMovementException;
import com.stocks.stockease.shared.InvoiceStateException;

import io.jsonwebtoken.JwtException;
import jakarta.persistence.EntityNotFoundException;

/*
 * Contract: which HTTP status each exception type earns, and whether the caller is told why.
 * One case per exception, asserting the status, the failed envelope, and the message.
 *
 * The message assertions split the exceptions into two kinds, and the split is the rule: domain
 * refusals pass their own message through verbatim, because it was written for the operator who
 * has to act on it, while authentication and authorization failures are answered with a fixed
 * phrase that says nothing a caller could use to probe what exists.
 *
 * This file is where the status-mapping rule concentrates, mirroring the handler itself - the
 * whole reason the handler is allowed to be long is that the mapping lives in exactly one place.
 *
 * Out of scope: the shape of the response body beyond its message. Handlers that assemble a
 * field-error payload, and the catch-all that answers whatever no rule here claimed, are
 * specified in GlobalExceptionErrorDetailTest.
 */
@SuppressWarnings("null") // Objects.requireNonNull() guarantees non-null at runtime
class GlobalExceptionStatusMappingTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    // --- 404 not found ---

    @Test
    void handleNoSuchElementException_returns404WithExceptionMessage() {
        var response = handler.handleNoSuchElementException(new NoSuchElementException("item missing"));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(404);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).contains("item missing");
    }

    @Test
    void handleEntityNotFoundException_returns404WithExceptionMessage() {
        var response = handler.handleEntityNotFoundException(new EntityNotFoundException("product 42"));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(404);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).contains("product 42");
    }

    // --- 401 unauthorized ---

    @Test
    void handleJwtException_returns401() {
        var response = handler.handleJwtException(new JwtException("token expired"));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("Invalid or expired token.");
    }

    @Test
    void handleBadCredentialsException_returns401() {
        var response = handler.handleBadCredentialsException(new BadCredentialsException("bad credentials"));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("Invalid username or password");
    }

    // --- 403 forbidden ---

    @Test
    void handleAccessDeniedException_returns403() {
        var response = handler.handleAccessDeniedException(new AccessDeniedException("access denied"));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(403);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("You do not have permission to access this resource.");
    }

    // --- 400 bad request ---

    @Test
    void handleIllegalArgumentException_returns400WithOriginalMessage() {
        var response = handler.handleIllegalArgumentException(new IllegalArgumentException("price must be positive"));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("price must be positive");
    }

    @Test
    void handleInvalidMovementException_returns400WithOriginalMessage() {
        var response = handler.handleInvalidMovementException(
                new InvalidMovementException("Quantity must be positive.",
                        ApiErrorCodes.MOVEMENT_QUANTITY_NOT_POSITIVE, null));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("Quantity must be positive.");
        // The handler passes the situation code straight through: the validation matrix has sixteen
        // rules all answering 400, and the code is the only thing on the envelope separating them.
        assertThat(body.getCode()).isEqualTo(ApiErrorCodes.MOVEMENT_QUANTITY_NOT_POSITIVE);
    }

    // --- 409 conflict ---

    @Test
    void handleInvoiceStateException_returns409WithOriginalMessage() {
        var response = handler.handleInvoiceStateException(
                new InvoiceStateException("Only open invoices can be closed.",
                        ApiErrorCodes.INVOICE_NOT_OPEN_FOR_CLOSE, null));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(409);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("Only open invoices can be closed.");
        // The handler passes the situation code straight through: the family covers five refusals
        // sharing this status, and the code is the only thing on the envelope that tells them apart.
        assertThat(body.getCode()).isEqualTo(ApiErrorCodes.INVOICE_NOT_OPEN_FOR_CLOSE);
    }

    @Test
    void handleEntityInUseException_returns409WithOriginalMessage() {
        var response = handler.handleEntityInUseException(
                new EntityInUseException("Cannot delete supplier 'Acme': open invoices exist.",
                        ApiErrorCodes.SUPPLIER_HAS_OPEN_INVOICES, Map.of("supplierName", "Acme")));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(409);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("Cannot delete supplier 'Acme': open invoices exist.");
    }

    @Test
    void handleDuplicateResourceException_returns409WithOriginalMessage() {
        var response = handler.handleDuplicateResourceException(
                new DuplicateResourceException("A product named 'Widget' already exists.",
                        ApiErrorCodes.DUPLICATE_PRODUCT_NAME, Map.of("name", "Widget")));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(409);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("A product named 'Widget' already exists.");
    }

    @Test
    void handleInsufficientStockException_returns409WithOriginalMessage() {
        var response = handler.handleInsufficientStockException(
                new InsufficientStockException("Adjustment of -5 would result in negative stock."));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(409);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("Adjustment of -5 would result in negative stock.");
    }
}
