package com.stocks.stockease.shared.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

import com.stocks.stockease.shared.ApiResponse;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Path;

/*
 * Contract: what the response body carries when the status alone would not tell a caller what to
 * fix. These handlers do work rather than map: they walk a binding result or a violation set and
 * assemble a field-keyed payload.
 *
 * Every case here answers 400 with the same envelope on purpose, so a client parses one shape
 * whether a parameter was missing, unreadable, or merely invalid - which is why the assertions
 * are on getData() rather than on the status. Each handler's failure branches get their own
 * test, because a branch that silently produced an empty map would still answer 400 and look
 * correct from the outside.
 *
 * The catch-all 500 lives here too: it is the branch that runs when nothing matched, and what it
 * must NOT do is leak the underlying exception's message to the caller.
 *
 * Out of scope: which status each exception type earns. That mapping is specified in
 * GlobalExceptionStatusMappingTest.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings({"null", "unchecked"}) // Objects.requireNonNull() guarantees non-null at runtime; mock(ConstraintViolation.class) produces an unavoidable unchecked cast
class GlobalExceptionErrorDetailTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

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
