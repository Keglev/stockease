
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
import com.stocks.stockease.dto.PaginatedResponse;
import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;

import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;

/**
 * REST controller for product inventory management.
 * 
 * Provides endpoints for CRUD operations, pagination, searching, and stock analytics.
 * All non-admin endpoints require USER or ADMIN role authentication via JWT.
 * Admin-only endpoints (create, delete) require ADMIN role.
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
@RestController
@RequestMapping("/api/products")
public class ProductController {

    private static final Logger log = LoggerFactory.getLogger(ProductController.class);

    private final ProductRepository productRepository;

    public ProductController(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    /**
     * Retrieves all products sorted by ID.
     * 
     * Loads entire inventory without pagination. Use {@link #getPagedProducts} for large datasets.
     * 
     * @return list of all products ordered by ID ascending
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<Product> getAllProducts() {
        return productRepository.findAllOrderById();
    }

    /**
     * Retrieves products with pagination support.
     * 
     * Prevents loading entire table into memory. Returns metadata including total count
     * and page information for client-side pagination controls.
     * 
     * @param page zero-based page number (default: 0)
     * @param size items per page (default: 10, must be positive)
     * @return paginated response with product list and metadata
     */
    @GetMapping("/paged")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<PaginatedResponse<Product>>> getPagedProducts(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Positive int size) {
        // Validate parameters via @Min/@Positive annotations; invalid values trigger 400 error
        Pageable pageable = PageRequest.of(page, size);
        Page<Product> products = productRepository.findAll(pageable);
        PaginatedResponse<Product> response = new PaginatedResponse<>(products);
        return ResponseEntity.ok(new ApiResponse<>(true, "Paged products fetched successfully", response));
    }

    /**
     * Retrieves a single product by ID.
     * 
     * Returns 404 if product not found.
     * 
     * @param id product identifier
     * @return product details if found; 404 error response if not
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<Product>> getProductById(@PathVariable Long id) {
        return productRepository.findById(id)
                .map(product -> ResponseEntity.ok(new ApiResponse<>(true, "Product fetched successfully", product)))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse<>(false, "The product with ID " + id + " does not exist.", null)));
    }

    /**
     * Creates a new product (ADMIN only).
     * 
     * Validates all required fields (name, quantity, price). Calculates total stock value
     * as quantity * price. Returns 400 if validation fails.
     * 
     * @param product product data (name, quantity, price)
     * @return created product with auto-generated ID
     * @throws IllegalArgumentException if required fields missing or invalid
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createProduct(@RequestBody(required = false) Product product) {
        log.debug("Received request to create product: {}", product);
        try {
            // Validate all required fields present and non-empty
            if (product == null || product.getName() == null || product.getName().isBlank() ||
                product.getQuantity() == null || product.getPrice() == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Incomplete update. Please fill in all required fields."));
            }

            // Business rule: quantity cannot be negative (invalid stock state)
            if (product.getQuantity() < 0) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Quantity cannot be negative."));
            }

            // Business rule: price must be positive (prevents free/negative cost items)
            if (product.getPrice() <= 0) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Price must be greater than 0."));
            }

            // Database saves product and generates auto-increment ID
            Product savedProduct = productRepository.save(product);
            return ResponseEntity.ok(savedProduct);

        } catch (Exception ex) {
            log.error("Unexpected error occurred: ", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "An unexpected error occurred. Please try again later."));
        }
    }

    /**
     * Deletes a product by ID (ADMIN only).
     * 
     * Returns 404 if product not found. Does not require product data in body.
     * 
     * @param id product identifier to delete
     * @return success message if deleted; error response if not found
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> deleteProduct(@PathVariable Long id) {
        log.info("Entering deleteProduct method with ID: {}", id);

        if (id == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse<>(false, "ID must be provided in the request.", null));
        }

        // Check if product exists before attempting deletion (avoids orphaned references)
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
     * Retrieves products with critically low stock.
     * 
     * Returns products where quantity < 5 (reorder threshold).
     * Returns success message if all products adequately stocked.
     * 
     * @return list of low-stock products; empty response if all stock levels sufficient
     */
    @GetMapping("/low-stock")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<?> getLowStockProducts() {
        // Hardcoded threshold (5 items) - consider making configurable via application.properties
        List<Product> lowStockProducts = productRepository.findByQuantityLessThan(5);
        if (lowStockProducts.isEmpty()) {
            return ResponseEntity.ok(Map.of("message", "All products are sufficiently stocked."));
        }
        return ResponseEntity.ok(lowStockProducts);
    }

    /**
     * Searches products by name (case-insensitive substring match).
     * 
     * Example: searching "apple" returns "Apple Juice", "APPLE", "Green Apple", etc.
     * Returns 204 NO_CONTENT if no matches found.
     * 
     * @param name search term (substring)
     * @return matching products; empty response if none found
     */
    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<?> searchProductsByName(@RequestParam String name) {
        // Case-insensitive LIKE query via repository
        List<Product> products = productRepository.findByNameContainingIgnoreCase(name);
        if (products.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NO_CONTENT)
                    .body(Map.of("message", "No products found matching the name: " + name));
        }
        return ResponseEntity.ok(products);
    }

    /**
     * Updates product quantity for a specific product.
     * 
     * Accepts quantity in request body. Automatically recalculates total stock value
     * (quantity * price). Prevents negative quantities.
     * 
     * @param id product identifier
     * @param request Map containing "quantity" field (integer)
     * @return updated product; error if quantity invalid or product not found
     */
    @PutMapping("/{id}/quantity")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<Product>> updateQuantity(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> request) {
        try {
            // Validate request payload structure
            if (request == null || !request.containsKey("quantity") || request.get("quantity") == null) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse<>(false, "Quantity field is missing or null.", null));
            }

            // Type check: quantity must be integer (prevents string/decimal injection)
            Object quantityObj = request.get("quantity");
            if (!(quantityObj instanceof Integer)) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse<>(false, "Quantity must be a valid integer.", null));
            }

            // Business rule: quantity cannot be negative (invalid inventory state)
            int newQuantity = (int) quantityObj;
            if (newQuantity < 0) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse<>(false, "Quantity cannot be negative.", null));
            }

            // Load product from DB; throws EntityNotFoundException if not found
            Product product = productRepository.findById(id)
                    .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));

            // Setter automatically recalculates totalValue = quantity * price
            product.setQuantity(newQuantity);
            Product updatedProduct = productRepository.save(product);

            return ResponseEntity.ok(new ApiResponse<>(true, "Quantity updated successfully", updatedProduct));
        } catch (EntityNotFoundException ex) {
            log.error("Product not found for ID: " + id, ex);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>(false, "Product not found.", null));
        } catch (Exception ex) {
            log.error("Unexpected error occurred while updating quantity for product with ID: " + id, ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, "An unexpected error occurred. Please try again later.", null));
        }
    }

    /**
     * Updates product price for a specific product.
     * 
     * Accepts price in request body (decimal). Automatically recalculates total stock value
     * (quantity * price). Prevents zero or negative prices.
     * 
     * @param id product identifier
     * @param request Map containing "price" field (number)
     * @return updated product; error if price invalid or product not found
     */
    @PutMapping("/{id}/price")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<Product>> updatePrice(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> request) {
        try {
            // Validate request payload structure
            if (request == null || !request.containsKey("price") || request.get("price") == null) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse<>(false, "Price field is missing or null.", null));
            }

            // Type check: price must be numeric (handles Integer, Double, BigDecimal via Number interface)
            Object priceObj = request.get("price");
            if (!(priceObj instanceof Number)) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse<>(false, "Price must be a valid number.", null));
            }

            // Business rule: price must be positive (prevents free or negative cost items)
            double newPrice = ((Number) priceObj).doubleValue();
            if (newPrice <= 0) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse<>(false, "Price must be greater than 0.", null));
            }

            // Load product from DB; throws EntityNotFoundException if not found
            Product product = productRepository.findById(id)
                    .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));

            // Setter automatically recalculates totalValue = quantity * price
            product.setPrice(newPrice);
            Product updatedProduct = productRepository.save(product);

            return ResponseEntity.ok(new ApiResponse<>(true, "Price updated successfully", updatedProduct));
        } catch (EntityNotFoundException ex) {
            log.error("Product not found for ID: " + id, ex);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>(false, "Product not found.", null));
        } catch (Exception ex) {
            log.error("Unexpected error occurred while updating price for product with ID: " + id, ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, "An unexpected error occurred. Please try again later.", null));
        }
    }

    /**
     * Updates product name for a specific product.
     * 
     * Validates that name is non-empty. Uniqueness constraint enforced at database level.
     * 
     * @param id product identifier
     * @param request Map containing "name" field (string)
     * @return updated product; error if name empty or product not found
     */
    @PutMapping("/{id}/name")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<Product>> updateName(@PathVariable Long id, @RequestBody Map<String, String> request) {
        try {
            // Validate name field: must be present and non-empty
            if (!request.containsKey("name") || request.get("name").isBlank()) {
                throw new IllegalArgumentException("Name is required and cannot be empty.");
            }

            String newName = request.get("name");

            // Load product from DB; throws EntityNotFoundException if not found
            Product product = productRepository.findById(id)
                    .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));

            product.setName(newName);
            Product updatedProduct = productRepository.save(product);

            return ResponseEntity.ok(new ApiResponse<>(true, "Name updated successfully", updatedProduct));
        } catch (EntityNotFoundException ex) {
            log.error("Product not found for ID: " + id, ex);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>(false, ex.getMessage(), null));
        } catch (IllegalArgumentException ex) {
            log.error("Invalid name provided for product with ID: " + id, ex);
            return ResponseEntity.badRequest()
                    .body(new ApiResponse<>(false, ex.getMessage(), null));
        } catch (Exception ex) {
            log.error("Unexpected error occurred while updating name for product with ID: " + id, ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, "An unexpected error occurred. Please try again later.", null));
        }
    }

    /**
     * Calculates total inventory value across all products.
     * 
     * Computes sum of (quantity * price) for all products.
     * Useful for financial reporting and inventory valuation.
     * 
     * @return total stock value as double
     */
    @GetMapping("/total-stock-value")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<Double>> getTotalStockValue() {
        try {
            // Custom aggregate query from repository - optimized at database level
            double totalStockValue = productRepository.calculateTotalStockValue();
            return ResponseEntity.ok(new ApiResponse<>(true, "Total stock value fetched successfully", totalStockValue));
        } catch (Exception ex) {
            log.error("Error calculating total stock value:", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, "Failed to fetch total stock value.", null));
        }
    }
}
