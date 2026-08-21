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

import com.stocks.stockease.shared.ApiErrorCodes;
import com.stocks.stockease.shared.ApiResponse;
import com.stocks.stockease.shared.DuplicateResourceException;
import com.stocks.stockease.shared.EntityInUseException;
import com.stocks.stockease.shared.InsufficientStockException;
import com.stocks.stockease.shared.InvalidMovementException;
import com.stocks.stockease.shared.InvalidRequestException;
import com.stocks.stockease.shared.InvoiceStateException;
import com.stocks.stockease.shared.ProductDeletedException;

import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.ConstraintViolationException;

// SIZE WAIVER (2026-08-07): 150 code lines vs the exception-advice alarm of >100. WAIVED: the
// "status mapping only in GlobalExceptionHandler" rule concentrates status mapping here by design,
// so the length is the rule working, not a missing split. Splitting would decentralize the one
// concern the rule centralizes.
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
     * Handles {@link IllegalArgumentException} and returns an uncoded 400 Bad Request response.
     *
     * <p>Every project throw site that used to land here now raises {@link InvalidRequestException}
     * instead, which the handler below answers with a code. What remains for this one is the
     * argument failure raised inside a library the application calls - a situation the project did
     * not name and has no advice to give about, so there is nothing for a code to identify. It stays
     * because such a failure is still the caller's fault and 400 is still the honest status; without
     * it the same request would answer 500 (ADR 041).
     *
     * @param ex the caught exception
     * @return 400 response with error message and no code
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<String>> handleIllegalArgumentException(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(false, ex.getMessage(), null));
    }

    /**
     * Handles {@link InvalidRequestException} from the domain's own request rules and returns a 400
     * Bad Request carrying the situation code the exception names.
     *
     * <p>Twelve situations across invoice creation, the two period-bound checks, the due-soon window
     * and the supplier's required fields. They share this status and ask the operator for different
     * things, so the code is what tells them apart. None of their sentences interpolates a value, so
     * none carries {@code params} today.
     *
     * <p>Declared separately from the {@link IllegalArgumentException} handler above rather than
     * replacing it: this type is not a subclass, and the two answer different kinds of failure - one
     * the project named, one a library raised (ADR 041, rulings R45 and R48).
     *
     * @param ex the caught exception
     * @return 400 response with the refusal message and its situation code
     */
    @ExceptionHandler(InvalidRequestException.class)
    public ResponseEntity<ApiResponse<String>> handleInvalidRequestException(InvalidRequestException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(false, ex.getMessage(), null, ex.getCode(), ex.getParams()));
    }

    /**
     * Handles {@link InvalidMovementException} from the stock movement validation matrix and returns
     * a 400 Bad Request carrying the situation code the exception names and any values its message
     * interpolates.
     *
     * <p>The matrix has sixteen rules and they all answer 400, so the code is the only thing that
     * tells them apart - which field is missing, which one the reason forbids, or how the movement
     * contradicts its invoice line. Six of the sixteen are reachable from the HTTP surface; the rest
     * guard callers only the service layer can produce, and say so in {@link ApiErrorCodes} (ADR 041,
     * rulings R45 and R47).
     *
     * @param ex the caught exception
     * @return 400 response with the rejected movement's message, its situation code and any params
     */
    @ExceptionHandler(InvalidMovementException.class)
    public ResponseEntity<ApiResponse<String>> handleInvalidMovementException(InvalidMovementException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(false, ex.getMessage(), null, ex.getCode(), ex.getParams()));
    }

    /**
     * Handles {@link InvoiceStateException} from invoice lifecycle rule violations and returns a 409
     * Conflict carrying the situation code the exception names and any values its message
     * interpolates.
     *
     * <p>The family covers five refusals - closing or deleting an invoice that is no longer open,
     * returning against one not yet closed, returning more than a line has outstanding, and paying
     * one already paid - which share a status and ask the operator for different things. The code is
     * what tells them apart. Only the returnable-quantity case carries {@code params}, naming the
     * quantity asked for, what remains and the line, so a client rendering its own translated text
     * has the numbers to put in it (ADR 041).
     *
     * @param ex the caught exception
     * @return 409 response with the lifecycle message, its situation code and any params
     */
    @ExceptionHandler(InvoiceStateException.class)
    public ResponseEntity<ApiResponse<String>> handleInvoiceStateException(InvoiceStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiResponse<>(false, ex.getMessage(), null, ex.getCode(), ex.getParams()));
    }

    /**
     * Handles {@link EntityInUseException} from deletions vetoed by referencing records and returns a 409
     * Conflict carrying the situation code the exception names and the values its message interpolates.
     *
     * <p>The family covers four situations - open invoices pinning a supplier, a customer or a
     * product, and a product still holding stock - and {@code params} carries the party or product
     * name the sentence quotes, plus the quantity where the refusal counts units.
     *
     * <p>This Javadoc previously recorded the opposite as design: no code, on the reasoning that a
     * client has nothing to do with a veto beyond showing its message. Ruling R44 reversed it. Three
     * of the four do share one operator remedy - settle the invoice first - so they fail the
     * distinct-action criterion that governs elsewhere; what outweighed it is that all four are
     * sentences a client renders in the reader's language, and a code is what lets it (ADR 041).
     *
     * @param ex the caught exception
     * @return 409 response with the veto message, its code and its params
     */
    @ExceptionHandler(EntityInUseException.class)
    public ResponseEntity<ApiResponse<String>> handleEntityInUseException(EntityInUseException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiResponse<>(false, ex.getMessage(), null, ex.getCode(), ex.getParams()));
    }

    /**
     * Handles {@link ProductDeletedException}, raised when an operation needs a product that has been
     * soft-deleted, and returns a 409 Conflict carrying {@link ApiErrorCodes#PRODUCT_DELETED}.
     *
     * <p>Declared separately from its parent above because Spring dispatches to the most specific
     * handler. It stays declared now that the parent carries codes too: the parent's handler would
     * emit the same envelope, and the separate declaration is what keeps this situation's code
     * fixed to the subtype rather than to whatever a call site passed. Without the distinction the
     * return endpoint's two 409s - this one and {@link InsufficientStockException} - would be
     * indistinguishable to a client that must give opposite advice for each.
     *
     * <p>The code is read from the exception rather than written here as a literal, so the subtype
     * constructor is the one place it is decided.
     *
     * @param ex the caught exception
     * @return 409 response with the refusal message and the deleted-product code
     */
    @ExceptionHandler(ProductDeletedException.class)
    public ResponseEntity<ApiResponse<String>> handleProductDeletedException(ProductDeletedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiResponse<>(false, ex.getMessage(), null, ex.getCode()));
    }

    /**
     * Handles {@link DuplicateResourceException} from unique attribute conflicts and returns a 409
     * Conflict carrying the situation code the exception names and the values its message
     * interpolates.
     *
     * <p>The family covers five situations - a taken product name, a taken SKU, either of those
     * blocking a restore, and a reused invoice number - which share a status and differ in what they
     * ask the operator to do. The code is what tells them apart, and {@code params} carries the name,
     * SKU or number the sentence quotes, so a client rendering its own translated text has the value
     * to put in it (ADR 041).
     *
     * @param ex the caught exception
     * @return 409 response with the conflict message, its situation code and its params
     */
    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ApiResponse<String>> handleDuplicateResourceException(DuplicateResourceException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiResponse<>(false, ex.getMessage(), null, ex.getCode(), ex.getParams()));
    }

    /**
     * Handles {@link InsufficientStockException} from quantity changes that would drive stock negative
     * and returns a 409 Conflict carrying {@link ApiErrorCodes#INSUFFICIENT_STOCK}.
     *
     * @param ex the caught exception
     * @return 409 response with the shortfall message and the insufficient-stock code
     */
    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<ApiResponse<String>> handleInsufficientStockException(InsufficientStockException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiResponse<>(false, ex.getMessage(), null, ApiErrorCodes.INSUFFICIENT_STOCK));
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
