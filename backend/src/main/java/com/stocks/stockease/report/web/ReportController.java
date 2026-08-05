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

import com.stocks.stockease.report.CashFlowReport;
import com.stocks.stockease.report.CashFlowTimelineBucket;
import com.stocks.stockease.report.CustomerSummary;
import com.stocks.stockease.report.DueDateBucket;
import com.stocks.stockease.report.InvoiceDueSummary;
import com.stocks.stockease.report.LossByRemark;
import com.stocks.stockease.report.LossReport;
import com.stocks.stockease.report.ProductProfitReport;
import com.stocks.stockease.report.ReportingService;
import com.stocks.stockease.report.StockHistoryPoint;
import com.stocks.stockease.report.StockStatusReport;
import com.stocks.stockease.report.SupplierProduct;
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
 * <p>Covers profit per product and per supplier, cash flow, stock status, losses, due-date buckets,
 * due-soon and overdue listings, the per-customer purchase summary and the per-supplier product
 * search. Those last two sit under this path rather than under the customer and supplier APIs because
 * the aggregation belongs to this module, even though what they describe is a customer and a
 * supplier's catalogue.
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

    /**
     * Returns money in and out over an optional payment period, overall and per product.
     *
     * @param from first payment date to count, or {@code null} for no lower bound
     * @param to last payment date to count, or {@code null} for no upper bound
     * @return the totals and the per-product breakdown
     * @throws IllegalArgumentException if {@code from} is after {@code to}
     */
    @GetMapping("/cash-flow")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public CashFlowReport cashFlow(
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        validatePeriod(from, to);
        return reportingService.cashFlow(from, to);
    }

    /**
     * Returns money in and out per calendar month over an optional payment period.
     *
     * <p>An optional {@code productId} narrows every bucket to one product's lines. The unscoped
     * call is unchanged: the predicate is a shared fragment that matches everything when the
     * parameter is absent, so the whole-business series is the same query it always was.
     *
     * @param from first payment date to count, or {@code null} for no lower bound
     * @param to last payment date to count, or {@code null} for no upper bound
     * @param productId product to scope the series to, or {@code null} for the whole business
     * @return one bucket per month that moved money, oldest first
     * @throws EntityNotFoundException if {@code productId} names no product
     * @throws IllegalArgumentException if {@code from} is after {@code to}
     */
    @GetMapping("/cash-flow/timeline")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<CashFlowTimelineBucket> cashFlowTimeline(
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long productId) {
        validatePeriod(from, to);
        // Checked rather than left to return an empty series, matching the stock-history endpoint: a
        // product that moved no money and a product that does not exist are different answers, and
        // only the second is the caller's mistake.
        if (productId != null && !reportingService.productExists(productId)) {
            throw new EntityNotFoundException("Product with ID " + productId + " not found.");
        }
        return reportingService.cashFlowTimeline(from, to, productId);
    }

    /**
     * Searches the products one supplier has sold this business, by a case-insensitive name match.
     *
     * <p>Sits under {@code /api/reports} rather than under the supplier API because the aggregation
     * is this module's - the linkage is drawn through the purchase ledger, which the supplier module
     * cannot read - even though what it describes is a supplier's catalogue. The same reasoning put
     * the customer summary here.
     *
     * <p>Nothing matching answers an empty array, not the 204-with-body of
     * {@code GET /api/products/search}; ADR 028 records why new search surface diverges there.
     *
     * @param id supplier identifier
     * @param name search term (substring, case-insensitive)
     * @return HTTP 200 with the supplier's matching products, empty if none match
     * @throws EntityNotFoundException if no live supplier exists with the given ID
     */
    @GetMapping("/suppliers/{id}/products/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<SupplierProduct> supplierProducts(@PathVariable long id, @RequestParam String name) {
        return reportingService.supplierProducts(id, name)
                .orElseThrow(() -> new EntityNotFoundException("Supplier with ID " + id + " not found."));
    }

    /**
     * Returns one product's stock level and cumulative units sold over the days that moved it.
     *
     * @param id product identifier
     * @param from first day to return, or {@code null} for no lower bound
     * @param to last day to return, or {@code null} for no upper bound
     * @return the product's history within the window, oldest first
     * @throws EntityNotFoundException if no such product exists
     * @throws IllegalArgumentException if {@code from} is after {@code to}
     */
    @GetMapping("/products/{id}/stock-history")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<StockHistoryPoint> stockHistory(@PathVariable long id,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        validatePeriod(from, to);
        // An empty optional means no such product; an empty list means one that never moved. Only
        // the first is a 404 - a product nobody has traded yet has a real, empty history.
        return reportingService.stockHistory(id, from, to)
                .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));
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
     * @param from first booking date to count, or {@code null} for no lower bound
     * @param to last booking date to count, or {@code null} for no upper bound
     * @return one row per supplier that has supplied at least one product
     * @throws IllegalArgumentException if {@code from} is after {@code to}
     */
    @GetMapping("/profit/suppliers")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<SupplierProfitReport> profitPerSupplier(
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        validatePeriod(from, to);
        return reportingService.profitPerSupplier(from, to);
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
     * @param from first booking date to count, or {@code null} for no lower bound
     * @param to last booking date to count, or {@code null} for no upper bound
     * @return one row per product with at least one loss movement in the window
     * @throws IllegalArgumentException if {@code from} is after {@code to}
     */
    @GetMapping("/losses")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<LossReport> lossReport(
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        validatePeriod(from, to);
        return reportingService.lossReport(from, to);
    }

    /**
     * Returns the same write-offs grouped by the remark recorded against them.
     *
     * <p>A sub-view of {@code /losses}, in the shape {@code /cash-flow/timeline} uses for its own:
     * the same window, the same losses, re-aggregated by cause rather than by product.
     *
     * @param from first booking date to count, or {@code null} for no lower bound
     * @param to last booking date to count, or {@code null} for no upper bound
     * @return one row per remark with at least one loss movement in the window
     * @throws IllegalArgumentException if {@code from} is after {@code to}
     */
    @GetMapping("/losses/by-remark")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<LossByRemark> lossesByRemark(
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        validatePeriod(from, to);
        return reportingService.lossesByRemark(from, to);
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
