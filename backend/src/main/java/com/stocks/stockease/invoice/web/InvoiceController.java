package com.stocks.stockease.invoice.web;

import java.util.Map;

import java.security.Principal;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.stocks.stockease.shared.ApiErrorCodes;
import com.stocks.stockease.shared.MissingEntityException;
import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.UserService;
import com.stocks.stockease.shared.ApiResponse;
import com.stocks.stockease.shared.PaginatedResponse;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;

/**
 * REST controller for the invoice lifecycle.
 *
 * <p>Covers creation, closing, payment marking, deletion and the list and detail reads, delegating
 * every operation to {@link InvoiceService}. Reads require at minimum ROLE_USER, as does creation;
 * closing, marking paid and deleting require ROLE_ADMIN. Registering a return is deliberately absent:
 * it belongs with the stock movement endpoints.
 */
@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
public class InvoiceController {

    private final InvoiceService invoiceService;
    private final UserService userService;

    /** Resolves the authenticated principal to the user recorded against the close. */
    private User currentUser(Principal principal) {
        return userService.findByUsername(principal.getName())
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found."));
    }

    /**
     * Returns every invoice, newest first.
     *
     * <p>Prefer {@code /paged} for anything user-facing: the invoice ledger is the one list here
     * that grows without bound, so a full read gets slower for the whole life of the deployment.
     *
     * @return list of invoice summaries carrying counterparty identifiers only
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<InvoiceSummaryResponse> getAllInvoices() {
        return invoiceService.findAll().stream().map(InvoiceSummaryResponse::from).toList();
    }

    /**
     * Returns a paginated slice of the invoice ledger, newest first.
     *
     * <p>Same rows, order and filtering as the unpaged sibling above - only sliced.
     *
     * @param page zero-based page index (default 0)
     * @param size items per page (default 10, must be positive)
     * @return {@link PaginatedResponse} with invoice summaries and pagination metadata
     */
    @GetMapping("/paged")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<PaginatedResponse<InvoiceSummaryResponse>>> getPagedInvoices(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Positive int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<InvoiceSummaryResponse> invoices = invoiceService.findAll(pageable).map(InvoiceSummaryResponse::from);
        PaginatedResponse<InvoiceSummaryResponse> response = new PaginatedResponse<>(invoices);
        return ResponseEntity.ok(new ApiResponse<>(true, "Paged invoices fetched successfully", response));
    }

    /**
     * Returns a single invoice in full, including its lines and counterparty names.
     *
     * @param id invoice identifier
     * @return HTTP 200 with the invoice detail
     * @throws MissingEntityException if no invoice exists with the given ID
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<InvoiceResponse>> getInvoiceById(@PathVariable long id) {
        Invoice invoice = invoiceService.findDetailById(id)
                .orElseThrow(() -> new MissingEntityException(
                        "Invoice with ID " + id + " not found.",
                        ApiErrorCodes.INVOICE_NOT_FOUND, Map.of("id", String.valueOf(id))));
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Invoice fetched successfully", InvoiceResponse.from(invoice)));
    }

    /**
     * Creates an invoice together with all of its lines.
     *
     * @param request the invoice and lines to create
     * @return HTTP 200 with the persisted invoice's summary including its generated ID
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<InvoiceSummaryResponse> createInvoice(@Valid @RequestBody CreateInvoiceRequest request) {
        Invoice created = invoiceService.createInvoice(request.toCommand());
        return ResponseEntity.ok(InvoiceSummaryResponse.from(created));
    }

    /**
     * Closes an open invoice, booking its lines into stock (ADMIN only).
     *
     * @param id invoice identifier
     * @param principal authenticated user, recorded against the close
     * @return HTTP 200 with the closed invoice's summary
     */
    @PatchMapping("/{id}/close")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<InvoiceSummaryResponse>> closeInvoice(@PathVariable long id,
            Principal principal) {
        Invoice closed = invoiceService.close(id, currentUser(principal));
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Invoice closed successfully", InvoiceSummaryResponse.from(closed)));
    }

    /**
     * Records that an invoice has been paid (ADMIN only).
     *
     * @param id invoice identifier
     * @return HTTP 200 with the paid invoice's summary
     */
    @PatchMapping("/{id}/paid")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<InvoiceSummaryResponse>> markInvoiceAsPaid(@PathVariable long id) {
        Invoice paid = invoiceService.markAsPaid(id);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Invoice marked as paid", InvoiceSummaryResponse.from(paid)));
    }

    /**
     * Deletes an open invoice (ADMIN only).
     *
     * @param id invoice identifier to delete
     * @return HTTP 200 on success
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> deleteInvoice(@PathVariable long id) {
        invoiceService.deleteById(id);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Invoice with ID " + id + " has been successfully deleted.", null));
    }
}
