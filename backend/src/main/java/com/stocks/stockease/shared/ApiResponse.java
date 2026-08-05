package com.stocks.stockease.shared;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.Data;

/**
 * Generic response envelope returned by all API endpoints.
 *
 * <p>Carries a success flag, a human-readable message, and a typed data payload.
 * {@code data} is {@code null} for error responses and operations with no output (e.g., DELETE).
 *
 * <p>Error responses may additionally carry a machine-readable {@link #code}. It is written only by
 * the shared exception handler, so a success envelope never has one and the success shape on the
 * wire is unchanged. See {@link ApiErrorCodes} for what the values mean and why they are a contract.
 */
@Data
public class ApiResponse<T> {

    /** {@code true} if the operation completed successfully. */
    private boolean success;

    /** Human-readable description of the outcome. */
    private String message;

    /** Operation result; {@code null} for errors or operations with no output (e.g., DELETE). */
    private T data;

    /**
     * Stable identifier for the failure, from {@link ApiErrorCodes}; {@code null} on success and on
     * failures that have no code assigned yet.
     *
     * <p>Omitted from the JSON entirely when null rather than serialized as {@code "code": null}: a
     * success body must keep the exact three-field shape every existing client parses, and an
     * uncoded error must read as "no code" rather than as a code whose value is null.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private String code;

    /**
     * Creates an envelope with no error code - the shape every success response and every
     * uncoded failure uses.
     *
     * @param success whether the operation succeeded
     * @param message human-readable outcome
     * @param data operation result, or {@code null}
     */
    public ApiResponse(boolean success, String message, T data) {
        this(success, message, data, null);
    }

    /**
     * Creates an envelope carrying a machine-readable error code.
     *
     * @param success whether the operation succeeded
     * @param message human-readable outcome
     * @param data operation result, or {@code null}
     * @param code stable failure identifier from {@link ApiErrorCodes}, or {@code null} for none
     */
    public ApiResponse(boolean success, String message, T data, String code) {
        this.success = success;
        this.message = message;
        this.data = data;
        this.code = code;
    }
}
