package com.stocks.stockease.report.web;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.stocks.stockease.report.CustomerSummary;
import com.stocks.stockease.report.DueDateBucket;
import com.stocks.stockease.report.InvoiceDueSummary;
import com.stocks.stockease.report.LossReport;
import com.stocks.stockease.report.ProductProfitReport;
import com.stocks.stockease.report.ReportingService;
import com.stocks.stockease.report.StockStatusReport;
import com.stocks.stockease.report.SupplierProfitReport;
import com.stocks.stockease.shared.ApiResponse;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

/**
 * REST controller exposing the reporting read model.
 *
 * <p>The report module's own records are serialized directly rather than remapped: the module depends
 * on no other module's types, so its records already are the API contract and a parallel set of
 * response records would duplicate them without adding isolation. Every report is read-only and
 * available to both roles.
 *
 * <p>Covers profit per product and per supplier, stock status, losses, due-date buckets, due-soon and
 * overdue listings, and the per-customer purchase summary. That last one sits under this path rather
 * than under the customer API because the aggregation belongs to this module, even though what it
 * describes is a customer.
 */
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    /** Window applied to the due-soon listing when the caller names none. */
    private static final int DEFAULT_DUE_SOON_DAYS = 7;

    private final ReportingService reportingService;

    /**
     * Returns gross profit for every product, including soft-deleted ones.
     *
     * @param from first booking date to count, or {@code null} for no lower bound
     * @param to last booking date to count, or {@code null} for no upper bound
     * @return one row per product, ordered by product ID
     * @throws IllegalArgumentException if {@code from} is after {@code to}
     */
    @GetMapping("/profit/products")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<ProductProfitReport> profitPerProduct(
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        validatePeriod(from, to);
        return reportingService.profitPerProduct(from, to);
    }

    /**
     * Returns gross profit for one product.
     *
     * @param id product identifier
     * @param from first booking date to count, or {@code null} for no lower bound
     * @param to last booking date to count, or {@code null} for no upper bound
     * @return HTTP 200 with the product's profit row
     * @throws EntityNotFoundException if no such product exists
     * @throws IllegalArgumentException if {@code from} is after {@code to}
     */
    @GetMapping("/profit/products/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<ProductProfitReport>> profitForProduct(@PathVariable long id,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        validatePeriod(from, to);
        ProductProfitReport report = reportingService.profitForProduct(id, from, to)
                .orElseThrow(() -> new EntityNotFoundException("No profit report for product with ID " + id + "."));
        return ResponseEntity.ok(new ApiResponse<>(true, "Product profit fetched successfully", report));
    }

    /** Rejects a period whose bounds are the wrong way round; either bound alone is always valid. */
    private static void validatePeriod(LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new IllegalArgumentException("The start of the period must not be after its end.");
        }
    }

    /**
     * Returns gross profit attributed to each supplier across the products it has supplied.
     *
     * @return one row per supplier that has supplied at least one product
     */
    @GetMapping("/profit/suppliers")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<SupplierProfitReport> profitPerSupplier() {
        return reportingService.profitPerSupplier();
    }

    /**
     * Returns what one customer has bought and returned across its booked sale invoices.
     *
     * @param id customer identifier
     * @return HTTP 200 with the customer's summary, zero-filled if it has no booked sales
     * @throws EntityNotFoundException if no such customer exists
     */
    @GetMapping("/customers/{id}/summary")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<CustomerSummary>> customerSummary(@PathVariable long id) {
        CustomerSummary summary = reportingService.customerSummary(id)
                .orElseThrow(() -> new EntityNotFoundException("Customer with ID " + id + " not found."));
        return ResponseEntity.ok(new ApiResponse<>(true, "Customer summary fetched successfully", summary));
    }

    /**
     * Returns what each live product has sold and what it still holds.
     *
     * @return one row per live product, ordered by product ID
     */
    @GetMapping("/stock-status")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<StockStatusReport> stockStatus() {
        return reportingService.stockStatus();
    }

    /**
     * Returns units written off as lost or destroyed.
     *
     * @return one row per product with at least one loss movement
     */
    @GetMapping("/losses")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<LossReport> lossReport() {
        return reportingService.lossReport();
    }

    /**
     * Returns unpaid invoices grouped by due date and invoice type.
     *
     * @return one bucket per due date and type, ordered by due date
     */
    @GetMapping("/due-dates")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<DueDateBucket> dueDateBuckets() {
        return reportingService.dueDateBuckets();
    }

    /**
     * Returns unpaid invoices falling due within the given window.
     *
     * @param days size of the window in days from today; defaults to a week
     * @return the matching invoices, ordered by due date
     * @throws IllegalArgumentException if {@code days} is not positive
     */
    @GetMapping("/due-soon")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<InvoiceDueSummary> dueSoon(
            @RequestParam(defaultValue = "" + DEFAULT_DUE_SOON_DAYS) int days) {
        if (days < 1) {
            throw new IllegalArgumentException("Days must be positive.");
        }
        return reportingService.dueSoon(days);
    }

    /**
     * Returns invoices that are booked, unpaid and past their due date.
     *
     * @return the overdue invoices with how many days each is late
     */
    @GetMapping("/overdue")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<InvoiceDueSummary> overdue() {
        return reportingService.overdue();
    }
}
