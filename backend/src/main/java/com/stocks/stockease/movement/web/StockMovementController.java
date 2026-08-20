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
 * REST controller for standalone stock corrections.
 *
 * <p>A loss ledger, and nothing else: it records only what left the shelves without a document of its
 * own - loss and destruction. Stock never arrives here. Incoming units exist exclusively as a
 * consequence of closing a purchase invoice (ADR 021), sales likewise come from closing, and returns
 * have their own endpoint, so this controller rejects every other reason outright.
 */
@RestController
@RequestMapping("/api/stock-movements")
@RequiredArgsConstructor
public class StockMovementController {

    /** The reasons this endpoint may record; everything else is booked elsewhere by design. */
    private static final Set<MovementReason> STANDALONE_REASONS =
            EnumSet.of(MovementReason.LOST, MovementReason.DESTROYED);

    private final StockMovementService stockMovementService;
    private final UserService userService;

    /** Resolves the authenticated principal to the user recorded against the movement. */
    private User currentUser(Principal principal) {
        return userService.findByUsername(principal.getName())
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found."));
    }

    /**
     * Records a standalone stock movement.
     *
     * @param request the movement to record
     * @param principal authenticated user, recorded against the movement
     * @return HTTP 200 with the persisted movement
     * @throws InvalidMovementException if the reason belongs to the invoice or return flows
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<MovementResponse> recordMovement(@Valid @RequestBody RecordMovementRequest request,
            Principal principal) {
        // the API surface refuses the reason before the service sees it, so a client cannot fabricate a
        // purchase or sale that no invoice accounts for
        if (!STANDALONE_REASONS.contains(request.reason())) {
            throw new InvalidMovementException(
                    "PURCHASE and SOLD movements exist only through invoice closing; returns use the return endpoint.",
                    ApiErrorCodes.MOVEMENT_REASON_NOT_STANDALONE, null);
        }
        StockMovement recorded = stockMovementService.recordMovement(request.toCommand(), currentUser(principal));
        return ResponseEntity.ok(MovementResponse.from(recorded));
    }
}
