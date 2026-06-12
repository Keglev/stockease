package com.stocks.stockease.exception;

import java.util.HashMap;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

import com.stocks.stockease.dto.ApiResponse;

import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.ConstraintViolationException;

/**
 * Centralized exception handler that intercepts exceptions from {@code @RestController} methods and converts them to HTTP responses.
 * All responses follow the {@link ApiResponse} envelope format with {@code success: false} and an appropriate HTTP status.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Handles {@link NoSuchElementException} thrown by collection operations and returns a 404 Not Found response.
     *
     * @param ex the caught exception
     * @return 404 response with error details
     */
    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ApiResponse<String>> handleNoSuchElementException(NoSuchElementException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiResponse<>(false, "Resource not found: " + ex.getMessage(), null));
    }

    /**
     * Handles {@link EntityNotFoundException} from JPA queries on non-existent records and returns a 404 Not Found response.
     *
     * @param ex the caught exception
     * @return 404 response with error details
     */
    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ApiResponse<String>> handleEntityNotFoundException(EntityNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiResponse<>(false, "Entity not found: " + ex.getMessage(), null));
    }

    /**
     * Handles {@link IllegalArgumentException} from business logic validation and returns a 400 Bad Request response.
     *
     * @param ex the caught exception
     * @return 400 response with error message
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<String>> handleIllegalArgumentException(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(false, ex.getMessage(), null));
    }

    /**
     * Handles {@link AccessDeniedException} from Spring Security authorization failures and returns a 403 Forbidden response.
     *
     * @param ex the caught exception
     * @return 403 response with permission error
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<String>> handleAccessDeniedException(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiResponse<>(false, "You do not have permission to access this resource.", null));
    }

    /**
     * Handles {@link io.jsonwebtoken.JwtException} for invalid or expired JWT tokens and returns a 401 Unauthorized response.
     *
     * @param ex the caught exception
     * @return 401 response with authentication error
     */
    @ExceptionHandler(io.jsonwebtoken.JwtException.class)
    public ResponseEntity<ApiResponse<String>> handleJwtException(io.jsonwebtoken.JwtException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse<>(false, "Invalid or expired token.", null));
    }

    /**
     * Handles {@link org.springframework.security.authentication.BadCredentialsException} for failed login attempts and returns a 401 Unauthorized response.
     *
     * @param ex the caught exception
     * @return 401 response with generic auth error
     */
    @ExceptionHandler(org.springframework.security.authentication.BadCredentialsException.class)
    public ResponseEntity<ApiResponse<String>> handleBadCredentialsException(
            org.springframework.security.authentication.BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse<>(false, "Invalid username or password", null));
    }

    /**
     * Handles {@link MethodArgumentNotValidException} from {@code @Valid} bean validation failures and returns a 400 Bad Request response with field-level errors.
     *
     * @param ex the caught exception
     * @return 400 response with field errors map
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidationException(MethodArgumentNotValidException ex) {
        Map<String, String> errors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .collect(Collectors.toMap(FieldError::getField, FieldError::getDefaultMessage));
        return ResponseEntity.badRequest()
                .body(new ApiResponse<>(false, "Validation failed for request parameters.", errors));
    }

    /**
     * Handles {@link org.springframework.http.converter.HttpMessageNotReadableException} for malformed or unreadable request bodies and returns a 400 Bad Request response.
     *
     * @param ex the caught exception
     * @return 400 response with parsing error
     */
    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<String>> handleHttpMessageNotReadableException(
            org.springframework.http.converter.HttpMessageNotReadableException ex) {
        String message = "Invalid or missing request body. Please check your input.";
        if (ex.getMessage() != null && ex.getMessage().contains("Cannot deserialize")) {
            message = "Invalid request format or data type.";
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(false, message, null));
    }

    /**
     * Handles {@link HandlerMethodValidationException} for path variable and request parameter validation failures and returns a 400 Bad Request response.
     *
     * @param ex the caught exception
     * @return 400 response with constraint violation details
     */
    @SuppressWarnings("preview") // Switch pattern matching requires Java 21+
    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleHandlerMethodValidationException(HandlerMethodValidationException ex) {
        Map<String, String> errors = new HashMap<>();

        // Pattern matching with if-else (Java 16+): cleaner than instanceof + cast
        Throwable cause = ex.getCause();
        if (cause instanceof ConstraintViolationException constraintViolationException) {
            constraintViolationException.getConstraintViolations().forEach(violation ->
                errors.put(violation.getPropertyPath().toString(), violation.getMessage())
            );
        } else if (cause instanceof BindException bindException) {
           bindException.getBindingResult().getFieldErrors().forEach(fieldError ->
                errors.put(fieldError.getField(), fieldError.getDefaultMessage())
           );
        } else {
           errors.put("Unknown", "Unable to extract detailed validation error.");
        }

       return ResponseEntity.badRequest()
           .body(new ApiResponse<>(false, "Validation failed for request parameters.", errors));
    }

    /**
     * Catches all uncaught exceptions as a safety net and returns a 500 Internal Server Error response.
     *
     * @param ex the caught exception
     * @return 500 response with generic error message
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<String>> handleGeneralException(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiResponse<>(false, "An unexpected error occurred. Please try again later.", null));
    }
}
