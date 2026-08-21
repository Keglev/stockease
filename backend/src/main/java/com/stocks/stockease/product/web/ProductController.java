package com.stocks.stockease.product.web;

import java.math.BigDecimal;
import java.security.Principal;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
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
import com.stocks.stockease.shared.ApiResponse;
import com.stocks.stockease.shared.MissingEntityException;
import com.stocks.stockease.shared.PaginatedResponse;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.UserService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;

/**
 * REST controller for product inventory management.
 *
 * <p>Covers CRUD, partial field updates, pagination, search, and stock analytics.
 * Full contract for every operation is defined in {@code docs/api/paths/products.yaml}.
 * All endpoints require at minimum ROLE_USER; create and delete require ROLE_ADMIN.
 *
 * <p>Stock quantities change exclusively through stock movements (the movements and returns
 * endpoints); direct quantity assignment no longer exists.
 */
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private static final Logger log = LoggerFactory.getLogger(ProductController.class);

    private final ProductService productService;
    private final UserService userService;

    /** Resolves the authenticated principal to the user recorded against product changes. */
    private User currentUser(Principal principal) {
        return userService.findByUsername(principal.getName())
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found."));
    }

    /**
     * Returns all products ordered by ID ascending.
     *
     * <p>Loads the entire catalogue into memory. Prefer {@link #getPagedProducts} for
     * large datasets. Behavior defined in {@code docs/api/paths/products.yaml}.
     *
     * @return list of all products ordered by ID
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<ProductResponse> getAllProducts() {
        return productService.getAllProducts().stream().map(ProductResponse::from).toList();
    }

    /**
     * Returns a paginated slice of the product catalogue.
     *
     * <p>Behavior defined in {@code docs/api/paths/products.yaml}.
     *
     * @param page zero-based page index (default 0)
     * @param size items per page (default 10, must be positive)
     * @return {@link PaginatedResponse} with product list and pagination metadata
     */
    @GetMapping("/paged")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<PaginatedResponse<ProductResponse>>> getPagedProducts(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Positive int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<ProductResponse> products = productService.getPagedProducts(pageable).map(ProductResponse::from);
        PaginatedResponse<ProductResponse> response = new PaginatedResponse<>(products);
        return ResponseEntity.ok(new ApiResponse<>(true, "Paged products fetched successfully", response));
    }

    /**
     * Lists soft-deleted products for the restore view (ADMIN only).
     *
     * <p>Unpaged and ordered by name: the recycle bin is a short administrative list. An empty bin is a
     * successful empty list, not a 404. Behavior defined in
     * {@code docs/backend/api/paths/products-deleted.yaml}.
     *
     * @return HTTP 200 with the soft-deleted products, empty list when none are deleted
     */
    @GetMapping("/deleted")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<ProductResponse>>> getDeletedProducts() {
        List<ProductResponse> deleted = productService.getDeletedProducts().stream()
                .map(ProductResponse::from).toList();
        return ResponseEntity.ok(new ApiResponse<>(true, "Deleted products fetched successfully", deleted));
    }

    /**
     * Returns a single product by its ID.
     *
     * <p>Behavior defined in {@code docs/api/paths/products.yaml}.
     *
     * @param id product identifier
     * @return HTTP 200 with the product, or HTTP 404 if not found
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<ProductResponse>> getProductById(@PathVariable long id) {
        // orElseThrow rather than the inline 404 this used to build: the sentence it wrote was its
        // own ("The product with ID 7 does not exist."), so the same situation read two ways
        // depending on which endpoint you hit. It now raises the family's exception and answers the
        // canonical sentence with PRODUCT_NOT_FOUND, like every other product lookup (ruling 4a).
        Product product = productService.findById(id)
                .orElseThrow(() -> new MissingEntityException(
                        "Product with ID " + id + " not found.",
                        ApiErrorCodes.PRODUCT_NOT_FOUND, Map.of("id", String.valueOf(id))));
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Product fetched successfully", ProductResponse.from(product)));
    }

    /**
     * Creates a new product (ADMIN only).
     *
     * <p>Validates that name and sku are non-blank and purchasePrice is positive. The product is
     * created at zero stock; no quantity is accepted here (ADR 018).
     * Behavior defined in {@code docs/api/paths/products.yaml}.
     *
     * @param request product fields (name, sku, purchasePrice)
     * @return HTTP 200 with the persisted product including its generated ID,
     *         or HTTP 400 if validation fails
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductResponse> createProduct(@Valid @RequestBody CreateProductRequest request) {
        log.debug("Received request to create product: {}", request);
        Product savedProduct = productService.create(request.getName(), request.getSku(), request.getPurchasePrice());
        return ResponseEntity.ok(ProductResponse.from(savedProduct));
    }

    /**
     * Deletes a product by ID (ADMIN only).
     *
     * <p>Behavior defined in {@code docs/api/paths/products.yaml}.
     *
     * @param id product identifier to delete
     * @param principal authenticated user, recorded against the deletion in the change log
     * @return HTTP 200 on success, HTTP 404 if the product does not exist
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> deleteProduct(@PathVariable long id, Principal principal) {
        log.info("Entering deleteProduct method with ID: {}", id);
        if (!productService.deleteById(id, currentUser(principal))) {
            // Same convergence as the fetch above: the inline sentence here was a third form of the
            // one situation ("Cannot delete. Product with ID 7 does not exist."). One situation, one
            // sentence, one code (ruling 4a).
            throw new MissingEntityException(
                    "Product with ID " + id + " not found.",
                    ApiErrorCodes.PRODUCT_NOT_FOUND, Map.of("id", String.valueOf(id)));
        }
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Product with ID " + id + " has been successfully deleted.", null)
        );
    }

    /**
     * Restores a soft-deleted product (ADMIN only).
     *
     * <p>Not destructive, so no confirmation step guards it. The restore is refused when a live product
     * has since taken the deleted product's name or SKU, because both are unique among live rows.
     * Behavior defined in {@code docs/backend/api/paths/products-restore.yaml}.
     *
     * @param id product identifier to restore
     * @param principal authenticated user, recorded against the restore in the change log
     * @return HTTP 200 with the restored product; HTTP 404 if no soft-deleted product carries that ID
     *         (unknown or still live), HTTP 409 if a live product already uses its name or SKU
     */
    @PostMapping("/{id}/restore")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ProductResponse>> restoreProduct(@PathVariable long id, Principal principal) {
        Product restored = productService.restore(id, currentUser(principal));
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Product restored successfully", ProductResponse.from(restored)));
    }

    /**
     * Returns products with critically low stock.
     *
     * <p>Threshold is hardcoded at 5 units; consider externalising to
     * {@code application.properties} if it needs to vary per environment.
     * Behavior defined in {@code docs/api/paths/products.yaml}.
     *
     * @return list of low-stock products, or a status message if all levels are sufficient
     */
    @GetMapping("/low-stock")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<?> getLowStockProducts() {
        List<Product> lowStockProducts = productService.findLowStock(5);
        if (lowStockProducts.isEmpty()) {
            return ResponseEntity.ok(Map.of("message", "All products are sufficiently stocked."));
        }
        return ResponseEntity.ok(lowStockProducts.stream().map(ProductResponse::from).toList());
    }

    /**
     * Searches live products by name using a case-insensitive substring match, capped for typeahead use.
     *
     * <p>For example, searching {@code "apple"} matches {@code "Apple Juice"}, {@code "APPLE"},
     * and {@code "Green Apple"}. Results are alphabetical and limited to
     * {@link com.stocks.stockease.shared.SearchLimits#TYPEAHEAD_LIMIT} rows; no match is 200 with an
     * empty array, the same contract as {@code /api/suppliers/search} and
     * {@code /api/reports/suppliers/{id}/products/search} (ADR 028). Behavior defined in
     * {@code docs/backend/api/paths/products-search.yaml}.
     *
     * @param name search term (substring, case-insensitive)
     * @return HTTP 200 with the matching products, empty if none match
     */
    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<ProductResponse> searchProductsByName(@RequestParam String name) {
        return productService.searchByName(name).stream().map(ProductResponse::from).toList();
    }

    /**
     * Updates the purchase price of a specific product.
     *
     * <p>{@code totalValue} in the response is derived from the updated price.
     * Behavior defined in {@code docs/api/paths/products.yaml}.
     *
     * @param id      product identifier
     * @param request request body containing a numeric {@code purchasePrice} field
     * @param principal authenticated user, recorded against the change in the change log
     * @return HTTP 200 with the updated product, or HTTP 400/404 on error
     */
    @PutMapping("/{id}/price")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<ProductResponse>> updatePrice(@PathVariable long id, @Valid @RequestBody UpdatePriceRequest request, Principal principal) {
        Product updatedProduct = productService.updatePrice(id, BigDecimal.valueOf(request.getPurchasePrice()), currentUser(principal));
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Price updated successfully", ProductResponse.from(updatedProduct)));
    }

    /**
     * Updates the name of a specific product.
     *
     * <p>Uniqueness is enforced at the database level. Behavior defined in
     * {@code docs/api/paths/products.yaml}.
     *
     * @param id      product identifier
     * @param request request body containing a non-blank {@code name} field
     * @param principal authenticated user, recorded against the change in the change log
     * @return HTTP 200 with the updated product, or HTTP 400/404 on error
     */
    @PutMapping("/{id}/name")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<ProductResponse>> updateName(@PathVariable long id, @Valid @RequestBody UpdateNameRequest request, Principal principal) {
        Product updatedProduct = productService.updateName(id, request.getName(), currentUser(principal));
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Name updated successfully", ProductResponse.from(updatedProduct)));
    }
}
