package com.stocks.stockease.product;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.product.internal.ProductRepository;
import com.stocks.stockease.security.User;
import com.stocks.stockease.shared.ApiErrorCodes;
import com.stocks.stockease.shared.DuplicateResourceException;
import com.stocks.stockease.shared.EntityInUseException;
import com.stocks.stockease.shared.InsufficientStockException;
import com.stocks.stockease.shared.SearchLimits;
import com.stocks.stockease.shared.SearchTerms;
import com.stocks.stockease.shared.TokenSearchSpec;

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
     * Creates and persists a new product at zero stock.
     *
     * <p>Creation is master-data maintenance and books no stock (ADR 018): the quantity is always 0,
     * and the first units arrive the only way any units do - by closing a purchase invoice (ADR 021).
     *
     * @param name product name; must not duplicate a live product's name, ignoring case
     * @param sku operator-assigned stock keeping unit; must not duplicate a live product's SKU
     * @param purchasePrice unit purchase price
     * @return the persisted product including its generated ID, holding zero stock
     * @throws DuplicateResourceException if a live product already carries that name or that SKU
     */
    @Transactional
    public Product create(String name, String sku, double purchasePrice) {
        // service check gives the friendly message, the partial unique index in the database is the
        // concurrency backstop
        if (productRepository.existsByNameIgnoreCase(name)) {
            throw new DuplicateResourceException("A product named '" + name + "' already exists.",
                    ApiErrorCodes.DUPLICATE_PRODUCT_NAME, Map.of("name", name));
        }
        // same split for the SKU: the friendly message here, uq_product_sku from V9 under concurrency
        if (productRepository.existsBySku(sku)) {
            throw new DuplicateResourceException("A product with SKU '" + sku + "' already exists.",
                    ApiErrorCodes.DUPLICATE_PRODUCT_SKU, Map.of("sku", sku));
        }
        // the entity still takes a quantity so movements can build products at any stock level; this
        // service is the gate that keeps creation at zero
        Product product = new Product(name, 0, purchasePrice);
        product.setSku(sku);
        return productRepository.save(product);
    }

    /**
     * Soft-deletes a product by ID and records the deletion in the change log.
     *
     * @param id product identifier
     * @param user user performing the deletion
     * @return {@code true} if the product existed and was deleted, {@code false} if no such product exists
     * @throws EntityInUseException if the product still holds stock, or if a listener vetoes the
     *         deletion because the product appears on an open invoice
     */
    @Transactional
    public boolean deleteById(long id, User user) {
        Optional<Product> found = productRepository.findById(id);
        if (found.isEmpty()) {
            return false;
        }
        Product product = found.get();
        // Stocked products are not deletable. Soft deletion hides the row from the catalogue, the
        // stock report and every picker, so deleting a stocked product would strand its units where
        // no surface shows them and no movement can reach them - inventory that exists only in the
        // ledger. Write the stock off or sell it first; the quantity is then honestly zero (ADR 033).
        if (product.getQuantity() != null && product.getQuantity() != 0) {
            // Read once and reused by both: the sentence and the params must name the same number,
            // and re-reading the getter for the map would let them drift apart.
            Integer quantity = product.getQuantity();
            throw new EntityInUseException("Cannot delete product '" + product.getName() + "': "
                    + quantity + " units are still in stock.",
                    ApiErrorCodes.PRODUCT_HAS_STOCK,
                    Map.of("productName", product.getName(),
                            "quantity", String.valueOf(quantity)));
        }
        // stamped explicitly rather than via repository.deleteById: that marks the entity removed, and the
        // change log row written by the listener may not reference a removed instance. Same soft-delete
        // result, and symmetric with restore below.
        product.setDeletedAt(LocalDateTime.now());
        productRepository.save(product);
        eventPublisher.publishEvent(
                new ProductChangedEvent(product, user, ProductChangedEvent.Field.DELETED, null, null));
        return true;
    }

    /**
     * Lists soft-deleted products alphabetically by name, so an administrator can pick one to restore.
     * Unpaged: the recycle bin is a short administrative list, not a browsable catalogue.
     *
     * @return soft-deleted products ordered case-insensitively by name
     */
    public List<Product> getDeletedProducts() {
        return productRepository.findAllDeleted();
    }

    /**
     * Revives a soft-deleted product, provided no live product has since taken its name or SKU.
     *
     * @param id product identifier
     * @param user user performing the restore
     * @return the restored product
     * @throws EntityNotFoundException if no soft-deleted product exists with the given ID
     * @throws DuplicateResourceException if a live product already carries the same name or SKU
     */
    @Transactional
    public Product restore(long id, User user) {
        Product product = productRepository.findDeletedById(id)
                .orElseThrow(() -> new EntityNotFoundException("No soft-deleted product with ID " + id + " found."));
        // live rows only - @SQLRestriction scopes both exists queries; the partial unique indexes are the
        // concurrency backstop
        if (productRepository.existsByNameIgnoreCase(product.getName())) {
            throw new DuplicateResourceException(
                    "Cannot restore: a live product named '" + product.getName() + "' already exists.",
                    ApiErrorCodes.RESTORE_BLOCKED_BY_NAME, Map.of("name", product.getName()));
        }
        if (productRepository.existsBySku(product.getSku())) {
            throw new DuplicateResourceException(
                    "Cannot restore: a live product with SKU '" + product.getSku() + "' already exists.",
                    ApiErrorCodes.RESTORE_BLOCKED_BY_SKU, Map.of("sku", product.getSku()));
        }
        product.setDeletedAt(null);
        Product saved = productRepository.save(product);
        eventPublisher.publishEvent(
                new ProductChangedEvent(saved, user, ProductChangedEvent.Field.RESTORED, null, null));
        return saved;
    }

    /**
     * Returns products whose stock quantity falls below {@code threshold}, scoped to products that have
     * ever been stocked. A product sold down to zero is the alert's most urgent case and stays listed;
     * a product that was never purchased is new, not low, and never appears (ADR 026).
     *
     * @param threshold quantity boundary (exclusive)
     * @return list of ever-stocked products below the threshold
     */
    public List<Product> findLowStock(int threshold) {
        return productRepository.findEverStockedByQuantityLessThan(threshold);
    }

    /**
     * Marks a product as having held stock. Idempotent: repeat calls on an already-marked product write
     * nothing, and no path ever clears the flag.
     *
     * @param product the product a purchase has just booked stock onto
     */
    @Transactional
    public void markEverStocked(Product product) {
        if (product.isEverStocked()) {
            return;
        }
        product.setEverStocked(true);
        // no change-log row: this is state derived from the purchase ledger, not master data an operator
        // edited, and the audit trail records what operators changed
        productRepository.save(product);
    }

    /**
     * Searches live products for the typeahead, matching every token of {@code term} against the
     * name or the SKU (ADR 035).
     *
     * <p>The term is split on whitespace and every word must hit one of the two fields, in any
     * order: "dru pap" finds "Druckerpapier A4" and "BUE" finds it by SKU. A blank term matches
     * everything, so it answers the first capped page alphabetically - which is what a focused,
     * empty picker browses.
     *
     * <p>The rest of the ADR 028 contract is unchanged: alphabetical, soft-deleted rows excluded,
     * at most {@link SearchLimits#TYPEAHEAD_LIMIT} rows, no match is an empty list.
     *
     * @param term search term, whitespace-separated; may be blank
     * @return matching products, alphabetical, at most {@link SearchLimits#TYPEAHEAD_LIMIT} of them
     */
    public List<Product> searchByName(String term) {
        return productRepository.findAll(
                TokenSearchSpec.<Product>matchingAllTokens(SearchTerms.tokenize(term), "name", "sku"),
                TokenSearchSpec.capped("name")).getContent();
    }

    /**
     * Applies a relative change to a product's stock quantity.
     *
     * @param id product identifier
     * @param delta signed number of units to add to the current quantity
     * @return the updated product
     * @throws EntityNotFoundException if no product exists with the given ID
     * @throws InsufficientStockException if the adjustment would drive the quantity below zero
     */
    @Transactional
    public Product adjustQuantity(long id, int delta) {
        // pessimistic lock serializes concurrent adjustments so the negative-stock check cannot race
        Product product = productRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));
        int newQuantity = product.getQuantity() + delta;
        if (newQuantity < 0) {
            throw new InsufficientStockException("Adjustment of " + delta + " would result in negative stock for product "
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
     * @throws DuplicateResourceException if a different live product already carries that name
     */
    @Transactional
    public Product updateName(long id, String name, User user) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Product with ID " + id + " not found."));
        // excluding this product's own row is what lets a rename fix only the capitalization of its own name
        if (productRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new DuplicateResourceException("A product named '" + name + "' already exists.",
                    ApiErrorCodes.DUPLICATE_PRODUCT_NAME, Map.of("name", name));
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
}
