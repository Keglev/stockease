package com.stocks.stockease.product;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.product.internal.ProductRepository;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

/**
 * Product module's public API for querying and mutating products.
 * Other modules depend on this service rather than reaching into the module's repository.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductService {

    private final ProductRepository productRepository;

    /**
     * Returns all products ordered by ID ascending.
     *
     * @return list of all products
     */
    public List<Product> getAllProducts() {
        return productRepository.findAllOrderById();
    }

    /**
     * Returns a paginated slice of the product catalogue.
     *
     * @param pageable page and size parameters
     * @return the requested page of products
     */
    public Page<Product> getPagedProducts(Pageable pageable) {
        return productRepository.findAll(pageable);
    }

    /**
     * Finds a product by its ID.
     *
     * @param id product identifier
     * @return the product, or empty if none exists with that ID
     */
    public Optional<Product> findById(long id) {
        return productRepository.findById(id);
    }

    /**
     * Creates and persists a new product.
     *
     * @param name product name
     * @param quantity stock quantity
     * @param purchasePrice unit purchase price
     * @return the persisted product including its generated ID
     */
    @Transactional
    public Product create(String name, int quantity, double purchasePrice) {
        return productRepository.save(new Product(name, quantity, purchasePrice));
    }

    /**
     * Deletes a product by ID.
     *
     * @param id product identifier
     * @return {@code true} if the product existed and was deleted, {@code false} if no such product exists
     */
    @Transactional
    public boolean deleteById(long id) {
        if (!productRepository.existsById(id)) {
            return false;
        }
        productRepository.deleteById(id);
        return true;
    }

    /**
     * Returns products whose stock quantity falls below {@code threshold}.
     *
     * @param threshold quantity boundary (exclusive)
     * @return list of products below the threshold
     */
    public List<Product> findLowStock(int threshold) {
        return productRepository.findByQuantityLessThan(threshold);
    }

    /**
     * Searches products by a case-insensitive substring match on name.
     *
     * @param name search substring
     * @return list of matching products
     */
    public List<Product> searchByName(String name) {
        return productRepository.findByNameContainingIgnoreCase(name);
    }

    /**
     * Updates a product's stock quantity.
     *
     * @param id product identifier
     * @param quantity new quantity
     * @return the updated product
     * @throws EntityNotFoundException if no product exists with the given ID
     */
    @Transactional
    public Product updateQuantity(long id, int quantity) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));
        product.setQuantity(quantity);
        return productRepository.save(product);
    }

    /**
     * Applies a relative change to a product's stock quantity.
     *
     * @param id product identifier
     * @param delta signed number of units to add to the current quantity
     * @return the updated product
     * @throws EntityNotFoundException if no product exists with the given ID
     * @throws IllegalStateException if the adjustment would drive the quantity below zero
     */
    @Transactional
    public Product adjustQuantity(long id, int delta) {
        // pessimistic lock serializes concurrent adjustments so the negative-stock check cannot race
        Product product = productRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));
        int newQuantity = product.getQuantity() + delta;
        if (newQuantity < 0) {
            throw new IllegalStateException("Adjustment of " + delta + " would result in negative stock for product "
                    + id + " (current: " + product.getQuantity() + ").");
        }
        product.setQuantity(newQuantity);
        return productRepository.save(product);
    }

    /**
     * Updates a product's purchase price.
     *
     * @param id product identifier
     * @param purchasePrice new purchase price
     * @return the updated product
     * @throws EntityNotFoundException if no product exists with the given ID
     */
    @Transactional
    public Product updatePrice(long id, BigDecimal purchasePrice) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));
        product.setPurchasePrice(purchasePrice);
        return productRepository.save(product);
    }

    /**
     * Updates a product's name.
     *
     * @param id product identifier
     * @param name new name
     * @return the updated product
     * @throws EntityNotFoundException if no product exists with the given ID
     */
    @Transactional
    public Product updateName(long id, String name) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));
        product.setName(name);
        return productRepository.save(product);
    }

    /**
     * Calculates the aggregate inventory value across all products.
     *
     * @return sum of quantity times purchase price across all products
     */
    public double getTotalStockValue() {
        return productRepository.calculateTotalStockValue();
    }
}
