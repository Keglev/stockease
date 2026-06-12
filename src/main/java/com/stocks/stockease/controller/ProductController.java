package com.stocks.stockease.controller;

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

import com.stocks.stockease.dto.ApiResponse;
import com.stocks.stockease.dto.CreateProductRequest;
import com.stocks.stockease.dto.PaginatedResponse;
import com.stocks.stockease.dto.UpdateNameRequest;
import com.stocks.stockease.dto.UpdatePriceRequest;
import com.stocks.stockease.dto.UpdateQuantityRequest;
import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;

import jakarta.persistence.EntityNotFoundException;
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
 */
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private static final Logger log = LoggerFactory.getLogger(ProductController.class);

    private final ProductRepository productRepository;

    /**
     * Returns all products ordered by ID ascending.
     *
     * <p>Loads the entire catalogue into memory. Prefer {@link #getPagedProducts} for
     * large datasets. Behavior defined in {@code docs/api/paths/products.yaml}.
     *
     * @return list of all {@link Product} entities ordered by ID
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<Product> getAllProducts() {
        return productRepository.findAllOrderById();
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
    public ResponseEntity<ApiResponse<PaginatedResponse<Product>>> getPagedProducts(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Positive int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Product> products = productRepository.findAll(pageable);
        PaginatedResponse<Product> response = new PaginatedResponse<>(products);
        return ResponseEntity.ok(new ApiResponse<>(true, "Paged products fetched successfully", response));
    }

    /**
     * Returns a single product by its ID.
     *
     * <p>Behavior defined in {@code docs/api/paths/products.yaml}.
     *
     * @param id product identifier
     * @return HTTP 200 with the {@link Product}, or HTTP 404 if not found
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<Product>> getProductById(@PathVariable long id) {
        return productRepository.findById(id)
                .map(product -> ResponseEntity.ok(new ApiResponse<>(true, "Product fetched successfully", product)))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse<>(false, "The product with ID " + id + " does not exist.", null)));
    }

    /**
     * Creates a new product (ADMIN only).
     *
     * <p>Validates that name is non-blank, quantity is non-negative, and price is positive.
     * Behavior defined in {@code docs/api/paths/products.yaml}.
     *
     * @param request product fields (name, quantity, price)
     * @return HTTP 200 with the persisted {@link Product} including its generated ID,
     *         or HTTP 400 if validation fails
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createProduct(@Valid @RequestBody CreateProductRequest request) {
        log.debug("Received request to create product: {}", request);
        Product savedProduct = productRepository.save(
                new Product(request.getName(), request.getQuantity(), request.getPrice()));
        return ResponseEntity.ok(savedProduct);
    }

    /**
     * Deletes a product by ID (ADMIN only).
     *
     * <p>Behavior defined in {@code docs/api/paths/products.yaml}.
     *
     * @param id product identifier to delete
     * @return HTTP 200 on success, HTTP 404 if the product does not exist
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> deleteProduct(@PathVariable long id) {
        log.info("Entering deleteProduct method with ID: {}", id);
        if (!productRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>(false, "Cannot delete. Product with ID " + id + " does not exist.", null));
        }
        productRepository.deleteById(id);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Product with ID " + id + " has been successfully deleted.", null)
        );
    }

    /**
     * Returns products with critically low stock.
     *
     * <p>Threshold is hardcoded at 5 units; consider externalising to
     * {@code application.properties} if it needs to vary per environment.
     * Behavior defined in {@code docs/api/paths/products.yaml}.
     *
     * @return list of low-stock {@link Product} entities, or a status message if all levels are sufficient
     */
    @GetMapping("/low-stock")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<?> getLowStockProducts() {
        List<Product> lowStockProducts = productRepository.findByQuantityLessThan(5);
        if (lowStockProducts.isEmpty()) {
            return ResponseEntity.ok(Map.of("message", "All products are sufficiently stocked."));
        }
        return ResponseEntity.ok(lowStockProducts);
    }

    /**
     * Searches products by name using a case-insensitive substring match.
     *
     * <p>For example, searching {@code "apple"} matches {@code "Apple Juice"}, {@code "APPLE"},
     * and {@code "Green Apple"}. Behavior defined in {@code docs/api/paths/products.yaml}.
     *
     * @param name search term (substring, case-insensitive)
     * @return HTTP 200 with matching products, or HTTP 204 if none found
     */
    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<?> searchProductsByName(@RequestParam String name) {
        List<Product> products = productRepository.findByNameContainingIgnoreCase(name);
        if (products.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NO_CONTENT)
                    .body(Map.of("message", "No products found matching the name: " + name));
        }
        return ResponseEntity.ok(products);
    }

    /**
     * Updates the stock quantity of a specific product.
     *
     * <p>{@link Product#setQuantity} automatically recalculates {@code totalValue}
     * (quantity × price). Behavior defined in {@code docs/api/paths/products.yaml}.
     *
     * @param id      product identifier
     * @param request request body containing an integer {@code quantity} field
     * @return HTTP 200 with the updated {@link Product}, or HTTP 400/404 on error
     */
    @PutMapping("/{id}/quantity")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<Product>> updateQuantity(@PathVariable long id, @Valid @RequestBody UpdateQuantityRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));
        product.setQuantity(request.getQuantity());
        Product updatedProduct = productRepository.save(product);
        return ResponseEntity.ok(new ApiResponse<>(true, "Quantity updated successfully", updatedProduct));
    }

    /**
     * Updates the price of a specific product.
     *
     * <p>{@link Product#setPrice} automatically recalculates {@code totalValue}
     * (quantity × price). Behavior defined in {@code docs/api/paths/products.yaml}.
     *
     * @param id      product identifier
     * @param request request body containing a numeric {@code price} field
     * @return HTTP 200 with the updated {@link Product}, or HTTP 400/404 on error
     */
    @PutMapping("/{id}/price")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<Product>> updatePrice(@PathVariable long id, @Valid @RequestBody UpdatePriceRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));
        product.setPrice(request.getPrice());
        Product updatedProduct = productRepository.save(product);
        return ResponseEntity.ok(new ApiResponse<>(true, "Price updated successfully", updatedProduct));
    }

    /**
     * Updates the name of a specific product.
     *
     * <p>Uniqueness is enforced at the database level. Behavior defined in
     * {@code docs/api/paths/products.yaml}.
     *
     * @param id      product identifier
     * @param request request body containing a non-blank {@code name} field
     * @return HTTP 200 with the updated {@link Product}, or HTTP 400/404 on error
     */
    @PutMapping("/{id}/name")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<Product>> updateName(@PathVariable long id, @Valid @RequestBody UpdateNameRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));
        product.setName(request.getName());
        Product updatedProduct = productRepository.save(product);
        return ResponseEntity.ok(new ApiResponse<>(true, "Name updated successfully", updatedProduct));
    }

    /**
     * Calculates the aggregate inventory value across all products.
     *
     * <p>Executes a database-level aggregate ({@code SUM(quantity * price)}) via
     * {@link ProductRepository#calculateTotalStockValue()}. Behavior defined in
     * {@code docs/api/paths/products.yaml}.
     *
     * @return HTTP 200 with the total stock value as a {@link Double}
     */
    @GetMapping("/total-stock-value")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<Double>> getTotalStockValue() {
        double totalStockValue = productRepository.calculateTotalStockValue();
        return ResponseEntity.ok(new ApiResponse<>(true, "Total stock value fetched successfully", totalStockValue));
    }
}
