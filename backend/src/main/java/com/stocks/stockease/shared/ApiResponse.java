package com.stocks.stockease.shared;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * Generic response envelope returned by all API endpoints.
 *
 * <p>Carries a success flag, a human-readable message, and a typed data payload.
 * {@code data} is {@code null} for error responses and operations with no output (e.g., DELETE).
 */
@Data
@AllArgsConstructor
public class ApiResponse<T> {

    /** {@code true} if the operation completed successfully. */
    private boolean success;

    /** Human-readable description of the outcome. */
    private String message;

    /** Operation result; {@code null} for errors or operations with no output (e.g., DELETE). */
    private T data;
}
