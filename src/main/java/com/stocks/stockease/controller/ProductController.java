package com.stocks.stockease.controller;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import com.stocks.stockease.model.Product;
import com.stocks.stockease.repository.ProductRepository;

import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private static final Logger log = LoggerFactory.getLogger(ProductController.class);

    private final ProductRepository productRepository;

    public ProductController(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    // Get all products
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public List<Product> getAllProducts() {
        return productRepository.findAllOrderById();
    }

    // Get a single product by ID
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<Product>> getProductById(@PathVariable Long id) {
        return productRepository.findById(id)
                .map(product -> ResponseEntity.ok(new ApiResponse<>(true, "Product fetched successfully", product)))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse<>(false, "The product with ID " + id + " does not exist.", null)));
    }

    // Create a new product
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createProduct(@RequestBody Product product) {
        // Validate required fields
        if (product.getName() == null || product.getName().isBlank() ||
            product.getQuantity() == null || product.getPrice() == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "Incomplete update. Please fill in all required fields."));
        }
    
        Product savedProduct = productRepository.save(product);
        return ResponseEntity.ok(savedProduct);
    }

    // Update an existing product
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateProduct(@PathVariable Long id, @Valid @RequestBody Product productDetails) {
        return productRepository.findById(id)
                .<ResponseEntity<?>>map(product -> {
                    product.setName(productDetails.getName());
                    product.setQuantity(productDetails.getQuantity());
                    product.setPrice(productDetails.getPrice());
                    Product updatedProduct = productRepository.save(product);
                    return ResponseEntity.ok(updatedProduct);
                })
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Unable to update. Product with ID " + id + " was not found.")));
    }

    // Delete a product
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> deleteProduct(@PathVariable Long id) {
        if (!productRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>(false, "Cannot delete. Product with ID " + id + " does not exist.", null));
        }
        productRepository.deleteById(id);
        return ResponseEntity.ok(new ApiResponse<>(true, "Product with ID " + id + " has been successfully deleted.", null));
    }



    @GetMapping("/low-stock")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<?> getLowStockProducts() {
        List<Product> lowStockProducts = productRepository.findByQuantityLessThan(5);
        if (lowStockProducts.isEmpty()) {
            return ResponseEntity.ok(Map.of("message", "All products are sufficiently stocked."));
        }
        return ResponseEntity.ok(lowStockProducts);
    }

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

    @PutMapping("/{id}/quantity")
    public ResponseEntity<ApiResponse<Product>> updateQuantity(@PathVariable Long id, @RequestBody Map<String, Integer> request) {
        try {
            int newQuantity = request.get("quantity");

            if (newQuantity < 0) {
            throw new IllegalArgumentException("Quantity cannot be negative.");
            }

            Product product = productRepository.findById(id)
                    .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));

            product.setQuantity(newQuantity);
            Product updatedProduct = productRepository.save(product);

            return ResponseEntity.ok(new ApiResponse<>(true, "Quantity updated successfully", updatedProduct));
        } catch (EntityNotFoundException ex) {
            log.error("Product not found for ID: " + id, ex);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>(false, "Product not found", null));
        } catch (IllegalArgumentException ex) {
            log.error("Invalid quantity value provided for product with ID: " + id, ex);
            return ResponseEntity.badRequest()
                    .body(new ApiResponse<>(false, "Invalid quantity value", null));
        } catch (Exception ex) {
            log.error("An unexpected error occurred while updating quantity for product with ID: " + id, ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>(false, "An unexpected error occurred. Please try again later.", null));
        }
    }
}
