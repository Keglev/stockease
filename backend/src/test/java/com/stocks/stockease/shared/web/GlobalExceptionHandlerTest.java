package com.stocks.stockease.shared.web;

import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

import com.stocks.stockease.shared.ApiResponse;
import com.stocks.stockease.shared.DuplicateResourceException;
import com.stocks.stockease.shared.EntityInUseException;
import com.stocks.stockease.shared.InsufficientStockException;
import com.stocks.stockease.shared.InvalidMovementException;
import com.stocks.stockease.shared.InvoiceStateException;

import io.jsonwebtoken.JwtException;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Path;

/**
 * Tests for {@link GlobalExceptionHandler} covering all exception handler methods and branch paths.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings({"null", "unchecked"}) // Objects.requireNonNull() guarantees non-null at runtime; mock(ConstraintViolation.class) produces an unavoidable unchecked cast
class GlobalExceptionHandlerTest {

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
    void handleMissingRequestParameter_returns400NamingTheParameter() {
        // without this case the catch-all below would answer 500 and tell the caller to retry later
        var response = handler.handleMissingRequestParameter(
                new MissingServletRequestParameterException("name", "String"));
        ApiResponse<Map<String, String>> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("Validation failed for request parameters.");
        // same envelope shape as the other parameter-validation cases, so clients parse one form
        assertThat(body.getData()).containsExactly(Map.entry("name", "required parameter is missing"));
    }

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
                new InvalidMovementException("Quantity must be positive."));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("Quantity must be positive.");
    }

    // --- 409 conflict ---

    @Test
    void handleInvoiceStateException_returns409WithOriginalMessage() {
        var response = handler.handleInvoiceStateException(
                new InvoiceStateException("Only open invoices can be closed."));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(409);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("Only open invoices can be closed.");
    }

    @Test
    void handleEntityInUseException_returns409WithOriginalMessage() {
        var response = handler.handleEntityInUseException(
                new EntityInUseException("Cannot delete supplier 'Acme': open invoices exist."));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(409);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("Cannot delete supplier 'Acme': open invoices exist.");
    }

    @Test
    void handleDuplicateResourceException_returns409WithOriginalMessage() {
        var response = handler.handleDuplicateResourceException(
                new DuplicateResourceException("A product named 'Widget' already exists."));
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

    // --- 400 bad request (continued) ---

    @Test
    void handleValidationException_returns400WithFieldErrors() {
        // Arrange
        // MethodArgumentNotValidException.getBindingResult() is final — construct a real instance to avoid stub restrictions
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "product");
        bindingResult.addError(new FieldError("product", "name", "must not be blank"));
        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(anyParam(), bindingResult);

        // Act
        ResponseEntity<ApiResponse<Map<String, String>>> response = handler.handleValidationException(ex);
        ApiResponse<Map<String, String>> body = Objects.requireNonNull(response.getBody());

        // Assert
        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getData()).containsEntry("name", "must not be blank");
    }

    @Test
    void handleValidationException_withTwoViolationsOnOneField_joinsMessagesInSortedOrder() {
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "product");
        // added in reverse of the expected order, so passing proves sorting rather than insertion order
        bindingResult.addError(new FieldError("product", "name", "must not be null"));
        bindingResult.addError(new FieldError("product", "name", "must not be blank"));
        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(anyParam(), bindingResult);

        ResponseEntity<ApiResponse<Map<String, String>>> response = handler.handleValidationException(ex);
        ApiResponse<Map<String, String>> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("Validation failed for request parameters.");
        assertThat(body.getData()).containsEntry("name", "must not be blank; must not be null");
    }

    @Test
    void handleHttpMessageNotReadableException_withNullMessage_returnsDefaultMessage() {
        HttpMessageNotReadableException ex = mock(HttpMessageNotReadableException.class);
        when(ex.getMessage()).thenReturn(null);

        var response = handler.handleHttpMessageNotReadableException(ex);
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(body.getMessage()).isEqualTo("Invalid or missing request body. Please check your input.");
    }

    @Test
    void handleHttpMessageNotReadableException_withGenericError_returnsDefaultMessage() {
        HttpMessageNotReadableException ex = mock(HttpMessageNotReadableException.class);
        when(ex.getMessage()).thenReturn("Required request body is missing");

        var response = handler.handleHttpMessageNotReadableException(ex);
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(body.getMessage()).isEqualTo("Invalid or missing request body. Please check your input.");
    }

    @Test
    void handleHttpMessageNotReadableException_withDeserializeError_returnsSpecificMessage() {
        HttpMessageNotReadableException ex = mock(HttpMessageNotReadableException.class);
        // "Cannot deserialize" in the message triggers the data-type-specific error response
        when(ex.getMessage()).thenReturn("Cannot deserialize value of type `int` from String");

        var response = handler.handleHttpMessageNotReadableException(ex);
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(body.getMessage()).isEqualTo("Invalid request format or data type.");
    }

    @Test
    void handleHandlerMethodValidationException_withConstraintViolationCause_returns400WithViolationDetails() {
        // Arrange
        ConstraintViolation<Object> violation = mock(ConstraintViolation.class);
        Path path = mock(Path.class);
        when(path.toString()).thenReturn("quantity");
        when(violation.getPropertyPath()).thenReturn(path);
        when(violation.getMessage()).thenReturn("must be greater than 0");

        // ConstraintViolationException's constructor calls violation.getMessage() and getPropertyPath() via super()
        // so the exception must be pre-constructed before entering when() context to avoid Mockito stubbing confusion
        ConstraintViolationException cvEx = new ConstraintViolationException(Set.of(violation));
        HandlerMethodValidationException ex = mock(HandlerMethodValidationException.class);
        when(ex.getCause()).thenReturn(cvEx);

        // Act
        ResponseEntity<ApiResponse<Map<String, String>>> response =
                handler.handleHandlerMethodValidationException(ex);
        ApiResponse<Map<String, String>> body = Objects.requireNonNull(response.getBody());

        // Assert
        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getData()).containsEntry("quantity", "must be greater than 0");
    }

    @Test
    void handleHandlerMethodValidationException_withBindExceptionCause_returns400WithFieldErrors() {
        // BindException.getBindingResult() is final — construct a real instance backed by BeanPropertyBindingResult
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "product");
        bindingResult.addError(new FieldError("product", "price", "must be positive"));
        BindException cause = new BindException(bindingResult);

        HandlerMethodValidationException ex = mock(HandlerMethodValidationException.class);
        when(ex.getCause()).thenReturn(cause);

        ResponseEntity<ApiResponse<Map<String, String>>> response =
                handler.handleHandlerMethodValidationException(ex);
        ApiResponse<Map<String, String>> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(body.getData()).containsEntry("price", "must be positive");
    }

    @Test
    void handleHandlerMethodValidationException_withUnknownCause_returns400WithUnknownKey() {
        HandlerMethodValidationException ex = mock(HandlerMethodValidationException.class);
        when(ex.getCause()).thenReturn(new RuntimeException("unrecognised validation error"));

        ResponseEntity<ApiResponse<Map<String, String>>> response =
                handler.handleHandlerMethodValidationException(ex);
        ApiResponse<Map<String, String>> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(body.getData()).containsKey("Unknown");
    }

    // --- 500 internal server error ---

    @Test
    void handleGeneralException_returns500() {
        var response = handler.handleGeneralException(new RuntimeException("unexpected failure"));
        ApiResponse<String> body = Objects.requireNonNull(response.getBody());

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(body.isSuccess()).isFalse();
        assertThat(body.getMessage()).isEqualTo("An unexpected error occurred. Please try again later.");
    }

    /** Returns a placeholder {@link MethodParameter} sufficient for constructing {@link MethodArgumentNotValidException}. */
    private static MethodParameter anyParam() {
        try {
            return new MethodParameter(Object.class.getDeclaredMethod("toString"), -1);
        } catch (NoSuchMethodException e) {
            throw new IllegalStateException("Object.toString() should always exist", e);
        }
    }
}
