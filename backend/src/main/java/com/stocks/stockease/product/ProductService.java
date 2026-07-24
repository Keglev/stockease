package com.stocks.stockease.product;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.product.internal.ProductRepository;
import com.stocks.stockease.security.User;

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
    private final ApplicationEventPublisher eventPublisher;

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
     * @param name product name; must not duplicate a live product's name, ignoring case
     * @param quantity stock quantity
     * @param purchasePrice unit purchase price
     * @return the persisted product including its generated ID
     * @throws IllegalStateException if a live product already carries that name
     */
    @Transactional
    public Product create(String name, int quantity, double purchasePrice) {
        // service check gives the friendly message, the partial unique index in the database is the
        // concurrency backstop
        if (productRepository.existsByNameIgnoreCase(name)) {
            throw new IllegalStateException("A product named '" + name + "' already exists.");
        }
        return productRepository.save(new Product(name, quantity, purchasePrice));
    }

    /**
     * Soft-deletes a product by ID and records the deletion in the change log.
     *
     * @param id product identifier
     * @param user user performing the deletion
     * @return {@code true} if the product existed and was deleted, {@code false} if no such product exists
     */
    @Transactional
    public boolean deleteById(long id, User user) {
        Optional<Product> found = productRepository.findById(id);
        if (found.isEmpty()) {
            return false;
        }
        // stamped explicitly rather than via repository.deleteById: that marks the entity removed, and the
        // change log row written by the listener may not reference a removed instance. Same soft-delete
        // result, and symmetric with restore below.
        Product product = found.get();
        product.setDeletedAt(LocalDateTime.now());
        productRepository.save(product);
        eventPublisher.publishEvent(
                new ProductChangedEvent(product, user, ProductChangedEvent.Field.DELETED, null, null));
        return true;
    }

    /**
     * Revives a soft-deleted product, provided no live product has since taken its name or SKU.
     *
     * @param id product identifier
     * @param user user performing the restore
     * @return the restored product
     * @throws EntityNotFoundException if no soft-deleted product exists with the given ID
     * @throws IllegalStateException if a live product already carries the same name or SKU
     */
    @Transactional
    public Product restore(long id, User user) {
        Product product = productRepository.findDeletedById(id)
                .orElseThrow(() -> new EntityNotFoundException("No soft-deleted product with ID " + id + " found."));
        // live rows only - @SQLRestriction scopes both exists queries; the partial unique indexes are the
        // concurrency backstop
        if (productRepository.existsByNameIgnoreCase(product.getName())) {
            throw new IllegalStateException(
                    "Cannot restore: a live product named '" + product.getName() + "' already exists.");
        }
        if (productRepository.existsBySku(product.getSku())) {
            throw new IllegalStateException(
                    "Cannot restore: a live product with SKU '" + product.getSku() + "' already exists.");
        }
        product.setDeletedAt(null);
        Product saved = productRepository.save(product);
        eventPublisher.publishEvent(
                new ProductChangedEvent(saved, user, ProductChangedEvent.Field.RESTORED, null, null));
        return saved;
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
        // quantity history lives exclusively in stock movements; never logged to the change log
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
     * Updates a product's purchase price and records the change in the change log.
     *
     * @param id product identifier
     * @param purchasePrice new purchase price
     * @param user user making the change
     * @return the updated product
     * @throws EntityNotFoundException if no product exists with the given ID
     */
    @Transactional
    public Product updatePrice(long id, BigDecimal purchasePrice, User user) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));
        BigDecimal oldPrice = product.getPurchasePrice();
        product.setPurchasePrice(purchasePrice);
        Product saved = productRepository.save(product);
        // compareTo, not equals: 2.50 and 2.5 are the same price at different scales and are not a change
        if (oldPrice.compareTo(purchasePrice) != 0) {
            eventPublisher.publishEvent(new ProductChangedEvent(saved, user,
                    ProductChangedEvent.Field.PURCHASE_PRICE, oldPrice.toPlainString(),
                    purchasePrice.toPlainString()));
        }
        return saved;
    }

    /**
     * Updates a product's name and records the change in the change log.
     *
     * @param id product identifier
     * @param name new name; must not duplicate another live product's name, ignoring case
     * @param user user making the change
     * @return the updated product
     * @throws EntityNotFoundException if no product exists with the given ID
     * @throws IllegalStateException if a different live product already carries that name
     */
    @Transactional
    public Product updateName(long id, String name, User user) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));
        // excluding this product's own row is what lets a rename fix only the capitalization of its own name
        if (productRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new IllegalStateException("A product named '" + name + "' already exists.");
        }
        String oldName = product.getName();
        product.setName(name);
        Product saved = productRepository.save(product);
        // exact comparison: a pure capitalization fix IS a change and is logged
        if (!name.equals(oldName)) {
            eventPublisher.publishEvent(
                    new ProductChangedEvent(saved, user, ProductChangedEvent.Field.NAME, oldName, name));
        }
        return saved;
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
