package com.stocks.stockease.product;

import static com.stocks.stockease.product.ProductTestFixtures.deletedProduct;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;

import com.stocks.stockease.shared.MissingEntityException;
import com.stocks.stockease.shared.ApiErrorCodes;
import com.stocks.stockease.product.internal.ProductRepository;
import com.stocks.stockease.security.User;
import com.stocks.stockease.shared.DuplicateResourceException;

import jakarta.persistence.EntityNotFoundException;

/*
 * Contract: a product's existence - create, deleteById and restore. These three are specified
 * together because they are the same rule read three times: a name and a SKU may be claimed by
 * only one live product, so creating checks the claim, deleting releases it, and restoring has
 * to re-acquire it and may fail where deleting could not.
 *
 * Deletion here is the soft kind: the row survives, which is what makes restore possible and why
 * a restore can be refused by a product created in the meantime.
 *
 * Out of scope: changing an existing product's attributes (ProductAttributeUpdateServiceTest),
 * its stock level (ProductStockServiceTest), and the read paths (ProductQueryServiceTest).
 */
@ExtendWith(MockitoExtension.class)
class ProductLifecycleServiceTest {

    private ProductTestFixtures fixtures;
    private ProductRepository productRepository;
    private ProductService productService;
    private User user;

    @BeforeEach
    void setUp() {
        fixtures = new ProductTestFixtures();
        productRepository = fixtures.productRepository;
        productService = fixtures.productService;
        user = fixtures.user;
    }

    private ProductChangedEvent publishedEvent() {
        return fixtures.publishedEvent();
    }

    @Test
    void create_withValidFields_savesAndReturnsProduct() {
        Product saved = new Product("Widget", 0, 5.0);
        when(productRepository.existsByNameIgnoreCase("Widget")).thenReturn(false);
        when(productRepository.existsBySku("WKZ-0001")).thenReturn(false);
        when(productRepository.save(any(Product.class))).thenReturn(saved);

        Product result = productService.create("Widget", "WKZ-0001", 5.0);

        assertThat(result).isSameAs(saved);
    }

    @Test
    void create_withAnyPrice_persistsTheProductAtZeroStockCarryingTheGivenSku() {
        when(productRepository.existsByNameIgnoreCase("Widget")).thenReturn(false);
        when(productRepository.existsBySku("WKZ-0001")).thenReturn(false);
        when(productRepository.save(any(Product.class))).thenAnswer(call -> call.getArgument(0));

        productService.create("Widget", "WKZ-0001", 5.0);

        ArgumentCaptor<Product> persisted = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(persisted.capture());
        assertThat(persisted.getValue().getQuantity()).isZero();
        assertThat(persisted.getValue().getSku()).isEqualTo("WKZ-0001");
    }

    @Test
    void create_withDuplicateName_throwsDuplicateResourceExceptionWithoutSaving() {
        when(productRepository.existsByNameIgnoreCase("widget")).thenReturn(true);

        assertThatThrownBy(() -> productService.create("widget", "WKZ-0001", 5.0))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessage("A product named 'widget' already exists.");
        verify(productRepository, never()).save(any(Product.class));
    }

    @Test
    void create_withDuplicateLiveSku_throwsDuplicateResourceExceptionWithoutSaving() {
        when(productRepository.existsByNameIgnoreCase("Widget")).thenReturn(false);
        when(productRepository.existsBySku("WKZ-0001")).thenReturn(true);

        assertThatThrownBy(() -> productService.create("Widget", "WKZ-0001", 5.0))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessage("A product with SKU 'WKZ-0001' already exists.");
        verify(productRepository, never()).save(any(Product.class));
    }

    @Test
    void deleteById_withExistingId_deletesAndReturnsTrue() {
        // zero stock: a stocked product is not deletable (ADR 033)
        Product product = new Product("Widget", 0, 5.0);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

        boolean result = productService.deleteById(1L, user);

        assertThat(result).isTrue();
        // soft delete is stamped on the entity rather than routed through repository.deleteById
        assertThat(product.getDeletedAt()).isNotNull();
        verify(productRepository, times(1)).save(product);
    }

    @Test
    void deleteById_withMissingId_returnsFalseWithoutDeleting() {
        when(productRepository.findById(1L)).thenReturn(Optional.empty());

        boolean result = productService.deleteById(1L, user);

        assertThat(result).isFalse();
        verify(productRepository, never()).save(any(Product.class));
    }

    @Test
    void deleteById_withExistingId_publishesDeletedEventWithNullValues() {
        Product product = new Product("Widget", 0, 5.0);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

        productService.deleteById(1L, user);

        ProductChangedEvent event = publishedEvent();
        assertThat(event.field()).isEqualTo(ProductChangedEvent.Field.DELETED);
        assertThat(event.oldValue()).isNull();
        assertThat(event.newValue()).isNull();
        assertThat(event.product()).isSameAs(product);
    }

    @Test
    void restore_withFreeNameAndSku_clearsDeletedAtAndPublishesRestored() {
        Product product = deletedProduct();
        when(productRepository.findDeletedById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(product)).thenReturn(product);

        Product result = productService.restore(1L, user);

        assertThat(result.getDeletedAt()).isNull();
        assertThat(publishedEvent().field()).isEqualTo(ProductChangedEvent.Field.RESTORED);
    }

    @Test
    void restore_withLiveNameConflict_throwsDuplicateResourceException() {
        when(productRepository.findDeletedById(1L)).thenReturn(Optional.of(deletedProduct()));
        when(productRepository.existsByNameIgnoreCase("Widget")).thenReturn(true);

        assertThatThrownBy(() -> productService.restore(1L, user))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessage("Cannot restore: a live product named 'Widget' already exists.");
    }

    @Test
    void restore_withLiveSkuConflict_throwsDuplicateResourceException() {
        when(productRepository.findDeletedById(1L)).thenReturn(Optional.of(deletedProduct()));
        when(productRepository.existsByNameIgnoreCase("Widget")).thenReturn(false);
        when(productRepository.existsBySku("SKU-1")).thenReturn(true);

        assertThatThrownBy(() -> productService.restore(1L, user))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessage("Cannot restore: a live product with SKU 'SKU-1' already exists.");
    }

    @Test
    void restore_withNoSoftDeletedRow_throwsEntityNotFoundException() {
        when(productRepository.findDeletedById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.restore(1L, user))
                // The subtype, not the parent: the parent still answers uncoded for a not-found JPA
                // raises, and asserting it here would pass whether or not this site was migrated.
                .isInstanceOf(MissingEntityException.class)
                .hasMessage("No soft-deleted product with ID 1 found.")
                .extracting(thrown -> ((MissingEntityException) thrown).getCode())
                .isEqualTo(ApiErrorCodes.SOFT_DELETED_PRODUCT_NOT_FOUND);
    }
}
