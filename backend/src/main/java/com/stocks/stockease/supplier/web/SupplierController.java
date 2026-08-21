package com.stocks.stockease.supplier.web;

import java.util.Map;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.stocks.stockease.shared.ApiErrorCodes;
import com.stocks.stockease.shared.MissingEntityException;
import com.stocks.stockease.shared.ApiResponse;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * REST controller for supplier master data.
 *
 * <p>Covers listing, lookup, creation, update and soft deletion, delegating every operation to
 * {@link SupplierService}. All endpoints require at minimum ROLE_USER; deletion requires ROLE_ADMIN.
 */
@RestController
@RequestMapping("/api/suppliers")
@RequiredArgsConstructor
public class SupplierController {

    private final SupplierService supplierService;

    /**
     * Returns every live supplier.
     *
     * @return list of all suppliers that have not been soft-deleted
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<SupplierResponse> getAllSuppliers() {
        return supplierService.findAll().stream().map(SupplierResponse::from).toList();
    }

    /**
     * Searches live suppliers by name using a case-insensitive substring match.
     *
     * <p>Built for the typeahead pickers: the result is capped and alphabetical, and nothing
     * matching answers an empty array rather than the 204-with-body that
     * {@code GET /api/products/search} returns. That endpoint's shape is a documented defect, not a
     * convention worth carrying onto new surface (ADR 028). Behavior defined in
     * {@code docs/backend/api/paths/suppliers-search.yaml}.
     *
     * @param name search term (substring, case-insensitive)
     * @return HTTP 200 with the matching suppliers, empty if none match
     */
    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<SupplierResponse> searchSuppliersByName(@RequestParam String name) {
        return supplierService.searchByName(name).stream().map(SupplierResponse::from).toList();
    }

    /**
     * Returns a single supplier by its ID.
     *
     * @param id supplier identifier
     * @return HTTP 200 with the supplier
     * @throws MissingEntityException if no supplier exists with the given ID
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<SupplierResponse>> getSupplierById(@PathVariable long id) {
        Supplier supplier = supplierService.findById(id)
                .orElseThrow(() -> new MissingEntityException(
                        "Supplier with ID " + id + " not found.",
                        ApiErrorCodes.SUPPLIER_NOT_FOUND, Map.of("id", String.valueOf(id))));
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Supplier fetched successfully", SupplierResponse.from(supplier)));
    }

    /**
     * Creates a new supplier.
     *
     * @param request supplier fields (name, address)
     * @return HTTP 200 with the persisted supplier including its generated ID
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<SupplierResponse> createSupplier(@Valid @RequestBody CreateSupplierRequest request) {
        Supplier saved = supplierService.create(request.name(), request.email(), request.phone(),
                request.address(), request.city());
        return ResponseEntity.ok(SupplierResponse.from(saved));
    }

    /**
     * Replaces a supplier's fields, including the optional contact ones.
     *
     * @param id supplier identifier
     * @param request new supplier fields (name, address)
     * @return HTTP 200 with the updated supplier
     * @throws MissingEntityException if no supplier exists with the given ID
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<SupplierResponse>> updateSupplier(@PathVariable long id,
            @Valid @RequestBody UpdateSupplierRequest request) {
        Supplier updated = supplierService.update(id, request.name(), request.email(), request.phone(),
                request.address(), request.city());
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Supplier updated successfully", SupplierResponse.from(updated)));
    }

    /**
     * Soft-deletes a supplier by ID (ADMIN only).
     *
     * @param id supplier identifier to delete
     * @return HTTP 200 on success
     * @throws MissingEntityException if no supplier exists with the given ID
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> deleteSupplier(@PathVariable long id) {
        supplierService.deleteById(id);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Supplier with ID " + id + " has been successfully deleted.", null));
    }
}
