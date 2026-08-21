package com.stocks.stockease.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import com.stocks.stockease.shared.MissingEntityException;
import com.stocks.stockease.shared.ApiErrorCodes;
import com.stocks.stockease.product.internal.ProductRepository;
import com.stocks.stockease.security.User;
import com.stocks.stockease.shared.DuplicateResourceException;

import jakarta.persistence.EntityNotFoundException;

/*
 * Contract: editing an existing product's name and purchase price. Both go through the same
 * shape - resolve, guard, write, announce - so they are specified together: whether the write
 * is allowed, and whether the change is worth announcing.
 *
 * The announcement half carries the audit trail, so "publishes nothing" is asserted as
 * deliberately as "publishes this". A no-op edit that still emitted an event would put a
 * change in the history that never happened, which is why identical names and equal prices at
 * different scales each have their own test.
 *
 * Out of scope: creating and deleting products (ProductLifecycleServiceTest), stock quantity
 * (ProductStockServiceTest), and the read paths (ProductQueryServiceTest).
 */
@ExtendWith(MockitoExtension.class)
class ProductAttributeUpdateServiceTest {

    private ProductTestFixtures fixtures;
    private ProductRepository productRepository;
    private ApplicationEventPublisher eventPublisher;
    private ProductService productService;
    private User user;

    @BeforeEach
    void setUp() {
        fixtures = new ProductTestFixtures();
        productRepository = fixtures.productRepository;
        eventPublisher = fixtures.eventPublisher;
        productService = fixtures.productService;
        user = fixtures.user;
    }

    private ProductChangedEvent publishedEvent() {
        return fixtures.publishedEvent();
    }

    @Test
    void updateName_toAnotherProductsName_throwsDuplicateResourceException() {
        Product product = new Product("Widget", 10, 5.0);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.existsByNameIgnoreCaseAndIdNot("Gadget", 1L)).thenReturn(true);

        assertThatThrownBy(() -> productService.updateName(1L, "Gadget", user))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessage("A product named 'Gadget' already exists.");
        verify(productRepository, never()).save(product);
    }

    @Test
    void updateName_toCaseVariantOfAnotherProductsName_throwsDuplicateResourceException() {
        Product product = new Product("Widget", 10, 5.0);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.existsByNameIgnoreCaseAndIdNot("GADGET", 1L)).thenReturn(true);

        assertThatThrownBy(() -> productService.updateName(1L, "GADGET", user))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessage("A product named 'GADGET' already exists.");
    }

    @Test
    void updateName_fixingOwnCapitalisation_succeeds() {
        Product product = new Product("widget", 10, 5.0);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.existsByNameIgnoreCaseAndIdNot("Widget", 1L)).thenReturn(false);
        when(productRepository.save(product)).thenReturn(product);

        Product result = productService.updateName(1L, "Widget", user);

        assertThat(result.getName()).isEqualTo("Widget");
    }

    @Test
    void updatePrice_withExistingId_updatesAndReturnsProduct() {
        Product product = new Product("Widget", 10, 5.0);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(product)).thenReturn(product);

        Product result = productService.updatePrice(1L, BigDecimal.TEN, user);

        assertThat(result.getPurchasePrice()).isEqualByComparingTo(BigDecimal.TEN);
    }

    @Test
    void updatePrice_withMissingId_throwsEntityNotFoundException() {
        when(productRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.updatePrice(1L, BigDecimal.TEN, user))
                // The subtype, not the parent: the parent still answers uncoded for a not-found JPA
                // raises, and asserting it here would pass whether or not this site was migrated.
                .isInstanceOf(MissingEntityException.class)
                .hasMessage("Product with ID 1 not found.")
                .extracting(thrown -> ((MissingEntityException) thrown).getCode())
                .isEqualTo(ApiErrorCodes.PRODUCT_NOT_FOUND);
    }

    @Test
    void updateName_withExistingId_updatesAndReturnsProduct() {
        Product product = new Product("Widget", 10, 5.0);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(product)).thenReturn(product);

        Product result = productService.updateName(1L, "Gadget", user);

        assertThat(result.getName()).isEqualTo("Gadget");
    }

    @Test
    void updateName_withMissingId_throwsEntityNotFoundException() {
        when(productRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.updateName(1L, "Gadget", user))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Product with ID 1 not found.");
    }

    @Test
    void updateName_withChangedName_publishesEventWithOldAndNewValues() {
        Product product = new Product("Widget", 10, 5.0);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(product)).thenReturn(product);

        productService.updateName(1L, "Gadget", user);

        ProductChangedEvent event = publishedEvent();
        assertThat(event.field()).isEqualTo(ProductChangedEvent.Field.NAME);
        assertThat(event.oldValue()).isEqualTo("Widget");
        assertThat(event.newValue()).isEqualTo("Gadget");
        assertThat(event.user()).isSameAs(user);
    }

    @Test
    void updateName_withIdenticalName_publishesNothing() {
        Product product = new Product("Widget", 10, 5.0);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(product)).thenReturn(product);

        productService.updateName(1L, "Widget", user);

        verify(eventPublisher, never()).publishEvent(any(ProductChangedEvent.class));
    }

    @Test
    void updatePrice_withChangedPrice_publishesEventWithPlainStringValues() {
        Product product = new Product("Widget", 10, 5.0);
        product.setPurchasePrice(new BigDecimal("5.00"));
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(product)).thenReturn(product);

        productService.updatePrice(1L, new BigDecimal("7.25"), user);

        ProductChangedEvent event = publishedEvent();
        assertThat(event.field()).isEqualTo(ProductChangedEvent.Field.PURCHASE_PRICE);
        assertThat(event.oldValue()).isEqualTo("5.00");
        assertThat(event.newValue()).isEqualTo("7.25");
    }

    @Test
    void updatePrice_withEqualValueAtDifferentScale_publishesNothing() {
        Product product = new Product("Widget", 10, 5.0);
        product.setPurchasePrice(new BigDecimal("2.50"));
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(product)).thenReturn(product);

        productService.updatePrice(1L, new BigDecimal("2.5"), user);

        verify(eventPublisher, never()).publishEvent(any(ProductChangedEvent.class));
    }
}
