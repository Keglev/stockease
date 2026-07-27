package com.stocks.stockease.audit.web;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.stocks.stockease.audit.AuditService;

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
}
