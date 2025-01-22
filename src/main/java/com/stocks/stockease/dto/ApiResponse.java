package com.stocks.stockease.dto;

/**
 * A generic API response class to standardize the structure of responses
 * sent from the server to the client.
 * 
 * @param <T> the type of the data object included in the response
 */
public class ApiResponse<T> {

    // Indicates whether the operation was successful
    private boolean success;

    // A message providing additional information about the operation
    private String message;

    // The data returned by the operation, if any
    private T data;

    /**
     * Constructs an ApiResponse with the provided parameters.
     * 
     * @param success whether the operation was successful
     * @param message a message describing the outcome of the operation
     * @param data the data returned by the operation (can be null)
     */
    public ApiResponse(boolean success, String message, T data) {
        this.success = success;
        this.message = message;
        this.data = data;
    }

    /**
     * Retrieves the success status of the operation.
     * 
     * @return true if the operation was successful, false otherwise
     */
    public boolean isSuccess() {
        return success;
    }

    /**
     * Updates the success status of the operation.
     * 
     * @param success the new success status
     */
    public void setSuccess(boolean success) {
        this.success = success;
    }

    /**
     * Retrieves the message describing the outcome of the operation.
     * 
     * @return the message
     */
    public String getMessage() {
        return message;
    }

    /**
     * Updates the message describing the outcome of the operation.
     * 
     * @param message the new message
     */
    public void setMessage(String message) {
        this.message = message;
    }

    /**
     * Retrieves the data returned by the operation.
     * 
     * @return the data, or null if no data was returned
     */
    public T getData() {
        return data;
    }

    /**
     * Updates the data returned by the operation.
     * 
     * @param data the new data
     */
    public void setData(T data) {
        this.data = data;
    }
}
