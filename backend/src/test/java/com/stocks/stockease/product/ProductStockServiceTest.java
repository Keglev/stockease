package com.stocks.stockease.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import com.stocks.stockease.product.internal.ProductRepository;
import com.stocks.stockease.shared.InsufficientStockException;

import jakarta.persistence.EntityNotFoundException;

/*
 * Contract: how much stock a product has - adjustQuantity, the everStocked flag, and the
 * low-stock query that reads both.
 *
 * These belong together because the flag is what makes the low-stock query answerable: a
 * product that has never been stocked is not low, it is simply unstocked, and only a product
 * that once held stock can be reported as running out (ADR 026). Quantity is also the one
 * attribute the service refuses to let go negative rather than clamping.
 *
 * Out of scope: creating, deleting and restoring products (ProductLifecycleServiceTest), name
 * and price edits (ProductAttributeUpdateServiceTest), and the general read paths
 * (ProductQueryServiceTest).
 */
@ExtendWith(MockitoExtension.class)
class ProductStockServiceTest {

    private ProductTestFixtures fixtures;
    private ProductRepository productRepository;
    private ProductService productService;

    @BeforeEach
    void setUp() {
        fixtures = new ProductTestFixtures();
        productRepository = fixtures.productRepository;
        productService = fixtures.productService;
    }

    @Test
    void findLowStock_withThreshold_returnsRepositoryResult() {
        Product product = new Product("Widget", 2, 5.0);
        when(productRepository.findEverStockedByQuantityLessThan(5)).thenReturn(List.of(product));

        assertThat(productService.findLowStock(5)).containsExactly(product);
    }

    @Test
    void markEverStocked_onUnflaggedProduct_setsTheFlag() {
        Product product = new Product("Widget", 10, 5.0);

        productService.markEverStocked(product);

        assertThat(product.isEverStocked()).isTrue();
        verify(productRepository, times(1)).save(product);
    }

    @Test
    void markEverStocked_onAlreadyFlaggedProduct_writesNothing() {
        Product product = new Product("Widget", 10, 5.0);
        product.setEverStocked(true);

        productService.markEverStocked(product);

        assertThat(product.isEverStocked()).isTrue();
        verify(productRepository, never()).save(any(Product.class));
    }

    @Test
    void adjustQuantity_withPositiveDelta_increasesAndReturnsProduct() {
        Product product = new Product("Widget", 10, 5.0);
        when(productRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(product)).thenReturn(product);

        Product result = productService.adjustQuantity(1L, 5);

        assertThat(result.getQuantity()).isEqualTo(15);
    }

    @Test
    void adjustQuantity_withNegativeDelta_decreasesAndReturnsProduct() {
        Product product = new Product("Widget", 10, 5.0);
        when(productRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(product)).thenReturn(product);

        Product result = productService.adjustQuantity(1L, -4);

        assertThat(result.getQuantity()).isEqualTo(6);
    }

    @Test
    void adjustQuantity_withDeltaBelowZero_throwsInsufficientStockException() {
        Product product = new Product("Widget", 3, 5.0);
        when(productRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> productService.adjustQuantity(1L, -5))
                .isInstanceOf(InsufficientStockException.class)
                .hasMessage("Adjustment of -5 would result in negative stock for product 1 (current: 3).");
    }

    @Test
    void adjustQuantity_withMissingId_throwsEntityNotFoundException() {
        when(productRepository.findByIdForUpdate(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.adjustQuantity(1L, 5))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Product with ID 1 not found.");
    }
}
