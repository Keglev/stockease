package com.stocks.stockease.shared.web;

import java.util.HashMap;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.stocks.stockease.shared.ApiResponse;
import com.stocks.stockease.shared.DuplicateResourceException;
import com.stocks.stockease.shared.EntityInUseException;
import com.stocks.stockease.shared.InsufficientStockException;
import com.stocks.stockease.shared.InvalidMovementException;
import com.stocks.stockease.shared.InvoiceStateException;

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
     * Handles {@link NoResourceFoundException}, raised when no handler is mapped to the requested path,
     * and returns a 404 Not Found response.
     *
     * <p>Without this the catch-all below claims an unmapped path is a server error. The distinction is
     * load-bearing for the demo module: with {@code app.demo.enabled} false its controllers are never
     * registered, and "this endpoint does not exist" has to read as 404 rather than as a 500 that
     * suggests it does exist and is broken.
     *
     * @param ex the caught exception
     * @return 404 response naming the path that matched nothing
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<String>> handleNoResourceFoundException(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiResponse<>(false, "No endpoint found for " + ex.getResourcePath() + ".", null));
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
     * Handles {@link InvalidMovementException} from the stock movement validation matrix and returns a 400 Bad Request response.
     *
     * @param ex the caught exception
     * @return 400 response with the rejected movement's error message
     */
    @ExceptionHandler(InvalidMovementException.class)
    public ResponseEntity<ApiResponse<String>> handleInvalidMovementException(InvalidMovementException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(false, ex.getMessage(), null));
    }

    /**
     * Handles {@link InvoiceStateException} from invoice lifecycle rule violations and returns a 409 Conflict response.
     *
     * @param ex the caught exception
     * @return 409 response with the lifecycle error message
     */
    @ExceptionHandler(InvoiceStateException.class)
    public ResponseEntity<ApiResponse<String>> handleInvoiceStateException(InvoiceStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiResponse<>(false, ex.getMessage(), null));
    }

    /**
     * Handles {@link EntityInUseException} from deletions vetoed by referencing records and returns a 409 Conflict response.
     *
     * @param ex the caught exception
     * @return 409 response with the veto message
     */
    @ExceptionHandler(EntityInUseException.class)
    public ResponseEntity<ApiResponse<String>> handleEntityInUseException(EntityInUseException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiResponse<>(false, ex.getMessage(), null));
    }

    /**
     * Handles {@link DuplicateResourceException} from unique attribute conflicts and returns a 409 Conflict response.
     *
     * @param ex the caught exception
     * @return 409 response with the conflict message
     */
    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ApiResponse<String>> handleDuplicateResourceException(DuplicateResourceException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiResponse<>(false, ex.getMessage(), null));
    }

    /**
     * Handles {@link InsufficientStockException} from quantity changes that would drive stock negative and returns a 409 Conflict response.
     *
     * @param ex the caught exception
     * @return 409 response with the shortfall message
     */
    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<ApiResponse<String>> handleInsufficientStockException(InsufficientStockException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
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
     * A field violating several constraints at once has its messages sorted and joined into one entry.
     *
     * @param ex the caught exception
     * @return 400 response with field errors map
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidationException(MethodArgumentNotValidException ex) {
        // grouped rather than collected into a map directly: one field can carry several violations, and
        // a plain toMap has no merge function, so it would throw and cost the client the whole envelope.
        // Sorting makes the joined value independent of the order constraints happen to be evaluated in.
        Map<String, String> errors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .collect(Collectors.groupingBy(FieldError::getField, TreeMap::new,
                        Collectors.mapping(FieldError::getDefaultMessage,
                                Collectors.collectingAndThen(Collectors.toList(), messages -> messages.stream()
                                        .sorted()
                                        .collect(Collectors.joining("; "))))));
        return ResponseEntity.badRequest()
                .body(new ApiResponse<>(false, "Validation failed for request parameters.", errors));
    }

    /**
     * Handles {@link MissingServletRequestParameterException}, raised when a required query parameter
     * is absent, and returns a 400 Bad Request response.
     *
     * <p>Without this case the catch-all below claims a caller's omitted parameter is a server error.
     * The distinction matters app-wide: every endpoint declaring a required {@code @RequestParam}
     * answered 500 to a request that simply left it out, which tells the caller to retry later rather
     * than to fix the request. The body follows the other parameter-validation cases - the offending
     * parameter names itself in {@code data} - so a client parses one shape whether the parameter was
     * missing or merely invalid.
     *
     * @param ex the caught exception
     * @return 400 response naming the missing parameter
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleMissingRequestParameter(
            MissingServletRequestParameterException ex) {
        Map<String, String> errors = Map.of(ex.getParameterName(), "required parameter is missing");
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
