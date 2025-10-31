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
 * Centralized exception handler for REST API error responses.
 * 
 * Design pattern: @RestControllerAdvice (AOP-based exception interception)
 * - Intercepts exceptions thrown in @RestController methods
 * - Converts exceptions to standardized HTTP responses (JSON)
 * - Decouples exception handling from business logic
 * 
 * Response format (all handlers):
 * {
 *   "success": false,
 *   "message": "Human-readable error description",
 *   "data": null or validation errors map
 * }
 * 
 * HTTP status mapping:
 * - 400 Bad Request: Invalid input, validation failures, malformed JSON
 * - 401 Unauthorized: Invalid/expired JWT, bad credentials
 * - 403 Forbidden: User lacks required role/permission
 * - 404 Not Found: Resource doesn't exist (product ID not found)
 * - 500 Internal Server Error: Unexpected runtime exceptions
 * 
 * Security considerations:
 * - Never expose stack traces to clients (prevents reconnaissance)
 * - Generic messages for auth failures (prevents username enumeration)
 * - Detailed validation errors for client-side form rendering
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Handles NoSuchElementException (Collection operations like Stream.get()).
     * 
     * Scenario: Business logic calls stream.findFirst().get() without Optional wrapping.
     * Response: 404 with user-friendly "Resource not found" message.
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
     * Handles JPA EntityNotFoundException (database queries on non-existent records).
     * 
     * Scenario: Service calls productRepository.getReferenceById() then accesses lazy fields.
     * Response: 404 with entity-specific message.
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
     * Handles IllegalArgumentException (business logic validation failures).
     * 
     * Scenario: Service validates input (e.g., quantity > 0) and throws with custom message.
     * Response: 400 with validation message (preserves business semantics).
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
     * Handles AccessDeniedException (Spring Security authorization failures).
     * 
     * Scenario: User with USER role attempts DELETE /api/products/123 (ADMIN only).
     * Response: 403 with permission denial message (complements SecurityConfig exception handler).
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
     * Handles JwtException (invalid/expired JWT tokens).
     * 
     * Scenario: JwtFilter detects malformed or expired token signature.
     * Response: 401 with security-appropriate message (doesn't expose token structure).
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
     * Handles BadCredentialsException (login with wrong password).
     * 
     * Scenario: AuthController authenticate(username, password) fails during login.
     * Response: 401 with generic message (prevents username enumeration).
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
     * Handles MethodArgumentNotValidException (@Valid bean validation failures).
     * 
     * Scenario: POST /api/products with missing @NotNull fields or @Size violations.
     * Response: 400 with field-level validation errors (enables frontend form highlighting).
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
     * Handles HttpMessageNotReadableException (malformed request body).
     * 
     * Scenario: POST /api/products with invalid JSON or type mismatch (e.g., string for price).
     * Response: 400 with user-friendly parsing error message.
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
     * Handles HandlerMethodValidationException (path variable/request param validation).
     * 
     * Scenario: GET /api/products/{id} with id="invalid" (expects Long) or @Min violation.
     * Response: 400 with validation error details extracted from cause chain.
     * 
     * Note: Uses if-else pattern matching (Java 16+). Switch pattern matching (Java 21+) not yet available.
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
            // Extract constraint violations (e.g., @Min, @NotNull on path variables)
            constraintViolationException.getConstraintViolations().forEach(violation -> 
                errors.put(violation.getPropertyPath().toString(), violation.getMessage())
            );
        } else if (cause instanceof BindException bindException) {
           // Extract field binding errors (type mismatches)
           bindException.getBindingResult().getFieldErrors().forEach(fieldError -> 
                errors.put(fieldError.getField(), fieldError.getDefaultMessage())
           );
        } else {
           // Fallback for null or unknown validation errors
           errors.put("Unknown", "Unable to extract detailed validation error.");
        }

       return ResponseEntity.badRequest()
           .body(new ApiResponse<>(false, "Validation failed for request parameters.", errors));
    }

    /**
     * Handles all other uncaught exceptions (safety net).
     * 
     * Scenario: Unexpected RuntimeException or database deadlock.
     * Response: 500 with generic message (never expose stack traces to clients).
     * 
     * Recommendation: Log full exception and stack trace server-side for debugging.
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
