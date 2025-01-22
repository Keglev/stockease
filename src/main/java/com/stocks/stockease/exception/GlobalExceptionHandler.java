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
 * Global exception handler for the application.
 * This class centralizes the handling of exceptions to provide consistent
 * responses across the application.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Handles cases where a requested resource is not found.
     * 
     * @param ex the exception thrown when no element is found
     * @return a response entity with a 404 status and error details
     */
    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ApiResponse<String>> handleNoSuchElementException(NoSuchElementException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiResponse<>(false, "Resource not found: " + ex.getMessage(), null));
    }

    /**
     * Handles cases where a requested entity is not found in the database.
     * 
     * @param ex the exception thrown when the entity is not found
     * @return a response entity with a 404 status and error details
     */
    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ApiResponse<String>> handleEntityNotFoundException(EntityNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiResponse<>(false, "Entity not found: " + ex.getMessage(), null));
    }

    /**
     * Handles invalid arguments passed to methods.
     * 
     * @param ex the exception thrown for invalid arguments
     * @return a response entity with a 400 status and error details
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<String>> handleIllegalArgumentException(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(false, ex.getMessage(), null));
    }

    /**
     * Handles general exceptions.
     * 
     * @param ex the exception thrown for general errors
     * @return a response entity with a 500 status and a generic error message
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<String>> handleGeneralException(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiResponse<>(false, "An unexpected error occurred. Please try again later.", null));
    }

    /**
     * Handles cases where a user does not have access to a resource.
     * 
     * @param ex the exception thrown for access denial
     * @return a response entity with a 403 status and an error message
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<String>> handleAccessDeniedException(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiResponse<>(false, "You do not have permission to access this resource.", null));
    }

    /**
     * Handles exceptions related to invalid or expired JWT tokens.
     * 
     * @param ex the exception thrown for JWT errors
     * @return a response entity with a 401 status and an error message
     */
    @ExceptionHandler(io.jsonwebtoken.JwtException.class)
    public ResponseEntity<ApiResponse<String>> handleJwtException(io.jsonwebtoken.JwtException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse<>(false, "Invalid or expired token.", null));
    }

    /**
     * Handles cases where authentication fails due to bad credentials.
     * 
     * @param ex the exception thrown for bad credentials
     * @return a response entity with a 401 status and an error message
     */
    @ExceptionHandler(org.springframework.security.authentication.BadCredentialsException.class)
    public ResponseEntity<ApiResponse<String>> handleBadCredentialsException(
            org.springframework.security.authentication.BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse<>(false, "Invalid username or password", null));
    }

    /**
     * Handles validation errors for method arguments.
     * 
     * @param ex the exception thrown for validation errors
     * @return a response entity with a 400 status and validation error details
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
     * Handles cases where the request body is invalid or unreadable.
     * 
     * @param ex the exception thrown for invalid request bodies
     * @return a response entity with a 400 status and an error message
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
     * Handles validation exceptions for handler methods.
     * 
     * @param ex the exception thrown for validation errors
     * @return a response entity with a 400 status and validation error details
     */
    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleHandlerMethodValidationException(HandlerMethodValidationException ex) {
        Map<String, String> errors = new HashMap<>();

        if (ex.getCause() instanceof ConstraintViolationException constraintViolationException) {
            // Collect errors from ConstraintViolationException
            constraintViolationException.getConstraintViolations().forEach(violation -> 
                errors.put(violation.getPropertyPath().toString(), violation.getMessage())
            );
        } else if (ex.getCause() instanceof BindException bindException) {
           // Collect errors from BindException
           bindException.getBindingResult().getFieldErrors().forEach(fieldError -> 
                errors.put(fieldError.getField(), fieldError.getDefaultMessage())
           );
        } else {
           // Default case: No specific validation details available
           errors.put("Unknown", "Unable to extract detailed validation error.");
        }

       // Return response with collected errors
       return ResponseEntity.badRequest()
           .body(new ApiResponse<>(false, "Validation failed for request parameters.", errors));
    }

}
