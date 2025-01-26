
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
 * Controller for managing product-related endpoints.
 * This includes CRUD operations, paginated fetching, and special queries.
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
     * Fetch all products.
     *
     * @return a list of all products
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<Product> getAllProducts() {
        return productRepository.findAllOrderById();
    }

    /**
     * Fetch paginated products.
     *
     * @param page the page number (0-based)
     * @param size the number of items per page
     * @return a paginated response of products
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
     * Fetch a single product by its ID.
     * 
     * @param id the product ID
     * @return the product details if found
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
     * Create a new product.
     *
     * @param product the product details to create
     * @return the created product
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createProduct(@RequestBody(required = false) Product product) {
        log.debug("Received request to create product: {}", product);
        try {
            if (product == null || product.getName() == null || product.getName().isBlank() ||
                product.getQuantity() == null || product.getPrice() == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Incomplete update. Please fill in all required fields."));
            }

            if (product.getQuantity() < 0) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Quantity cannot be negative."));
            }

            if (product.getPrice() <= 0) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Price must be greater than 0."));
            }

            Product savedProduct = productRepository.save(product);
            return ResponseEntity.ok(savedProduct);

        } catch (Exception ex) {
            log.error("Unexpected error occurred: ", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "An unexpected error occurred. Please try again later."));
        }
    }

    /**
     * Delete a product by ID.
     *
     * @param id the product ID to delete
     * @return a confirmation message
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> deleteProduct(@PathVariable Long id) {
        log.info("Entering deleteProduct method with ID: {}", id);

        if (id == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse<>(false, "ID must be provided in the request.", null));
        }

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
     * Fetch products with low stock.
     *
     * @return a list of products with stock less than 5
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
     * Search products by name.
     *
     * @param name the name to search for
     * @return a list of matching products
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
     * Update the quantity of a product.
     *
     * @param id the product ID
     * @param request the request containing the new quantity
     * @return the updated product
     */
    @PutMapping("/{id}/quantity")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<Product>> updateQuantity(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> request) {
        try {
            if (request == null || !request.containsKey("quantity") || request.get("quantity") == null) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse<>(false, "Quantity field is missing or null.", null));
            }

            Object quantityObj = request.get("quantity");
            if (!(quantityObj instanceof Integer)) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse<>(false, "Quantity must be a valid integer.", null));
            }

            int newQuantity = (int) quantityObj;
            if (newQuantity < 0) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse<>(false, "Quantity cannot be negative.", null));
            }

            Product product = productRepository.findById(id)
                    .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));

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
     * Update the price of a product.
     *
     * @param id the product ID
     * @param request the request containing the new price
     * @return the updated product
     */
    @PutMapping("/{id}/price")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<Product>> updatePrice(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> request) {
        try {
            if (request == null || !request.containsKey("price") || request.get("price") == null) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse<>(false, "Price field is missing or null.", null));
            }

            Object priceObj = request.get("price");
            if (!(priceObj instanceof Number)) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse<>(false, "Price must be a valid number.", null));
            }

            double newPrice = ((Number) priceObj).doubleValue();
            if (newPrice <= 0) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse<>(false, "Price must be greater than 0.", null));
            }

            Product product = productRepository.findById(id)
                    .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));

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
     * Update the name of a product.
     *
     * @param id the product ID
     * @param request the request containing the new name
     * @return the updated product
     */
    @PutMapping("/{id}/name")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<Product>> updateName(@PathVariable Long id, @RequestBody Map<String, String> request) {
        try {
            if (!request.containsKey("name") || request.get("name").isBlank()) {
                throw new IllegalArgumentException("Name is required and cannot be empty.");
            }

            String newName = request.get("name");

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
     * Calculate the total stock value.
     *
     * @return the total stock value
     */
    @GetMapping("/total-stock-value")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<Double>> getTotalStockValue() {
        try {
            double totalStockValue = productRepository.calculateTotalStockValue();
            return ResponseEntity.ok(new ApiResponse<>(true, "Total stock value fetched successfully", totalStockValue));
        } catch (Exception ex) {
            log.error("Error calculating total stock value:", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, "Failed to fetch total stock value.", null));
        }
    }
}
