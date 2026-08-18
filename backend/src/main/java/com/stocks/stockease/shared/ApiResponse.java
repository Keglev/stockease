package com.stocks.stockease.shared;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.Data;

/**
 * Generic response envelope returned by all API endpoints.
 *
 * <p>Carries a success flag, a human-readable message, and a typed data payload.
 * {@code data} is {@code null} for error responses and operations with no output (e.g., DELETE).
 *
 * <p>Error responses may additionally carry a machine-readable {@link #code} and the {@link #params}
 * that code's situation names. Both are written only by the shared exception handler, so a success
 * envelope never has either and the success shape on the wire is unchanged. See {@link ApiErrorCodes}
 * for what the values mean and why they are a contract.
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
     * The runtime values the failure's own sentence interpolates, keyed by name; {@code null}
     * whenever {@link #code} is absent, and on coded failures whose situation names none.
     *
     * <p>A client that translates from the code renders its own sentence and needs these to fill it,
     * because the server's {@link #message} is the only place those values otherwise appear and it
     * is not translatable (ADR 041). Omitted when null by the same rule as {@code code}, so the two
     * optional fields serialize identically and a reader learns one convention rather than two.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Map<String, String> params;

    /**
     * Creates an envelope with no error code - the shape every success response and every
     * uncoded failure uses.
     *
     * @param success whether the operation succeeded
     * @param message human-readable outcome
     * @param data operation result, or {@code null}
     */
    public ApiResponse(boolean success, String message, T data) {
        this(success, message, data, null, null);
    }

    /**
     * Creates an envelope carrying a machine-readable error code and no parameters.
     *
     * @param success whether the operation succeeded
     * @param message human-readable outcome
     * @param data operation result, or {@code null}
     * @param code stable failure identifier from {@link ApiErrorCodes}, or {@code null} for none
     */
    public ApiResponse(boolean success, String message, T data, String code) {
        this(success, message, data, code, null);
    }

    /**
     * Creates an envelope carrying a machine-readable error code and the values its sentence names.
     *
     * @param success whether the operation succeeded
     * @param message human-readable outcome
     * @param data operation result, or {@code null}
     * @param code stable failure identifier from {@link ApiErrorCodes}, or {@code null} for none
     * @param params values the failure's sentence interpolates, or {@code null} for none
     */
    public ApiResponse(boolean success, String message, T data, String code, Map<String, String> params) {
        this.success = success;
        this.message = message;
        this.data = data;
        this.code = code;
        this.params = params;
    }
}
