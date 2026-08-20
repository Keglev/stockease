package com.stocks.stockease.movement.web;

import java.security.Principal;
import java.util.EnumSet;
import java.util.Set;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.stocks.stockease.movement.MovementReason;
import com.stocks.stockease.movement.StockMovement;
import com.stocks.stockease.movement.StockMovementService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.UserService;
import com.stocks.stockease.shared.ApiErrorCodes;
import com.stocks.stockease.shared.InvalidMovementException;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * REST controller for returning units against an invoice line.
 *
 * <p>Lives in the movement module rather than the invoice module because the movement service is what
 * orchestrates a return: it records the movement and calls the invoice module to raise the line's
 * returned quantity within one transaction. Movement depends on invoice, never the reverse, so an
 * invoice-side return controller would close that dependency into a cycle.
 */
@RestController
@RequestMapping("/api/returns")
@RequiredArgsConstructor
public class ReturnController {

    /** The two directions a return can run; every other reason belongs to another flow. */
    private static final Set<MovementReason> RETURN_REASONS =
            EnumSet.of(MovementReason.RETURN_FROM_CUSTOMER, MovementReason.RETURNED_TO_SUPPLIER);

    private final StockMovementService stockMovementService;
    private final UserService userService;

    /** Resolves the authenticated principal to the user recorded against the return. */
    private User currentUser(Principal principal) {
        return userService.findByUsername(principal.getName())
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found."));
    }

    /**
     * Records a return against an invoice line, updating both the stock and the line's returned quantity.
     *
     * @param request the return to record
     * @param principal authenticated user, recorded against the movement
     * @return HTTP 200 with the persisted movement
     * @throws InvalidMovementException if the reason is not one of the two return directions
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<MovementResponse> registerReturn(@Valid @RequestBody RegisterReturnRequest request,
            Principal principal) {
        if (!RETURN_REASONS.contains(request.reason())) {
            throw new InvalidMovementException("This endpoint records returns only.",
                    ApiErrorCodes.MOVEMENT_ENDPOINT_RETURNS_ONLY, null);
        }
        StockMovement recorded = stockMovementService.recordMovement(request.toCommand(), currentUser(principal));
        return ResponseEntity.ok(MovementResponse.from(recorded));
    }
}
