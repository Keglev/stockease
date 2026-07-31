package com.stocks.stockease.audit.web;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.stocks.stockease.audit.AuditService;
import com.stocks.stockease.audit.ChangeLogEntryResponse;

import lombok.RequiredArgsConstructor;

/**
 * REST controller exposing the product change log.
 *
 * <p>Read-only by nature: the log's write side is the event listener that records changes as they
 * happen, never an API call. Both listings are available to either role.
 */
@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService auditService;

    /**
     * Returns every product change a user made, newest first.
     *
     * @param userId user identifier
     * @return that user's change log entries ordered by creation time descending
     */
    @GetMapping("/users/{userId}/changes")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<ChangeLogResponse> getChangesByUser(@PathVariable long userId) {
        return auditService.findChangesByUser(userId).stream().map(ChangeLogResponse::from).toList();
    }

    /**
     * Returns the full change history of one product, newest first.
     *
     * @param productId product identifier
     * @return that product's change log entries ordered by creation time descending
     */
    @GetMapping("/products/{productId}/changes")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<ChangeLogResponse> getChangesByProduct(@PathVariable long productId) {
        return auditService.findChangesByProduct(productId).stream().map(ChangeLogResponse::from).toList();
    }

    /**
     * Returns recent product changes across the system, newest first, with the names behind the IDs.
     *
     * @param from first change date to include, or {@code null} for no lower bound
     * @param to last change date to include, or {@code null} for no upper bound
     * @return the newest changes in the window, capped server-side
     * @throws IllegalArgumentException if {@code from} is after {@code to}
     */
    @GetMapping("/changes")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<ChangeLogEntryResponse> getChanges(
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        validatePeriod(from, to);
        return auditService.findChanges(from, to);
    }

    /**
     * Rejects a period whose bounds are the wrong way round; either bound alone is always valid.
     *
     * <p>Restated here rather than imported from the reporting controller that carries the identical
     * check. The two modules share no code by design, and a web-layer helper is not an API either of
     * them offers the other - six lines duplicated is the cheaper of the two couplings, and the
     * shared exception handler already gives both the same 400 and the same message.
     */
    private static void validatePeriod(LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new IllegalArgumentException("The start of the period must not be after its end.");
        }
    }
}
