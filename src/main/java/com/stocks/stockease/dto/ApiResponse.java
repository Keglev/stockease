package com.stocks.stockease.dto;

/**
 * Generic wrapper for all API responses.
 * 
 * Standardizes response format across endpoints with success flag,
 * optional message, and typed data payload. Enables consistent
 * client-side response handling.
 * 
 * Example JSON response:
 * {
 *   "success": true,
 *   "message": "Operation successful",
 *   "data": { Object }
 * }
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
public class ApiResponse<T> {

    /**
     * Success indicator. True if operation completed successfully, false otherwise.
     * Used by clients to determine response handling logic.
     */
    private boolean success;

    /**
     * Human-readable message describing operation outcome.
     * Examples: "Login successful", "Product not found", "Validation error"
     */
    private String message;

    /**
     * Typed data payload returned by operation.
     * May be null for error responses or operations with no data output (e.g., DELETE).
     */
    private T data;

    /**
     * Constructs a complete API response.
     * 
     * @param success whether operation succeeded
     * @param message human-readable outcome message
     * @param data operation result (null if no data)
     */
    public ApiResponse(boolean success, String message, T data) {
        this.success = success;
        this.message = message;
        this.data = data;
    }

    /**
     * Returns success status of operation.
     * 
     * @return true if successful; false otherwise
     */
    public boolean isSuccess() {
        return success;
    }

    /**
     * Sets success status of operation.
     * 
     * @param success success flag
     */
    public void setSuccess(boolean success) {
        this.success = success;
    }

    /**
     * Returns outcome message.
     * 
     * @return message string
     */
    public String getMessage() {
        return message;
    }

    /**
     * Sets outcome message.
     * 
     * @param message message text
     */
    public void setMessage(String message) {
        this.message = message;
    }

    /**
     * Returns operation result data.
     * 
     * @return typed data object; null if no data
     */
    public T getData() {
        return data;
    }

    /**
     * Sets operation result data.
     * 
     * @param data typed data object
     */
    public void setData(T data) {
        this.data = data;
    }
}
