package com.stocks.stockease.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import com.stocks.stockease.product.internal.ProductRepository;

import jakarta.persistence.EntityNotFoundException;

/** Tests for {@link ProductService} covering each method's happy path and error paths. */
@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    private ProductRepository productRepository;
    private ProductService productService;

    @BeforeEach
    void setUp() {
        productRepository = mock(ProductRepository.class);
        productService = new ProductService(productRepository);
    }

    @Test
    void getAllProducts_withProducts_returnsRepositoryResult() {
        Product product = new Product("Widget", 10, 5.0);
        when(productRepository.findAllOrderById()).thenReturn(List.of(product));

        assertThat(productService.getAllProducts()).containsExactly(product);
    }

    @Test
    void getPagedProducts_withPageable_returnsRepositoryPage() {
        Product product = new Product("Widget", 10, 5.0);
        Pageable pageable = PageRequest.of(0, 10);
        Page<Product> page = new PageImpl<>(List.of(product));
        when(productRepository.findAll(pageable)).thenReturn(page);

        assertThat(productService.getPagedProducts(pageable)).isSameAs(page);
    }

    @Test
    void findById_withExistingId_returnsProduct() {
        Product product = new Product("Widget", 10, 5.0);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

        assertThat(productService.findById(1L)).contains(product);
    }

    @Test
    void findById_withMissingId_returnsEmpty() {
        when(productRepository.findById(1L)).thenReturn(Optional.empty());

        assertThat(productService.findById(1L)).isEmpty();
    }

    @Test
    void create_withValidFields_savesAndReturnsProduct() {
        Product saved = new Product("Widget", 10, 5.0);
        when(productRepository.existsByNameIgnoreCase("Widget")).thenReturn(false);
        when(productRepository.save(any(Product.class))).thenReturn(saved);

        Product result = productService.create("Widget", 10, 5.0);

        assertThat(result).isSameAs(saved);
    }

    @Test
    void create_withDuplicateName_throwsIllegalStateExceptionWithoutSaving() {
        when(productRepository.existsByNameIgnoreCase("widget")).thenReturn(true);

        assertThatThrownBy(() -> productService.create("widget", 10, 5.0))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("A product named 'widget' already exists.");
        verify(productRepository, never()).save(any(Product.class));
    }

    @Test
    void updateName_toAnotherProductsName_throwsIllegalStateException() {
        Product product = new Product("Widget", 10, 5.0);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.existsByNameIgnoreCaseAndIdNot("Gadget", 1L)).thenReturn(true);

        assertThatThrownBy(() -> productService.updateName(1L, "Gadget"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("A product named 'Gadget' already exists.");
        verify(productRepository, never()).save(product);
    }

    @Test
    void updateName_toCaseVariantOfAnotherProductsName_throwsIllegalStateException() {
        Product product = new Product("Widget", 10, 5.0);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.existsByNameIgnoreCaseAndIdNot("GADGET", 1L)).thenReturn(true);

        assertThatThrownBy(() -> productService.updateName(1L, "GADGET"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("A product named 'GADGET' already exists.");
    }

    @Test
    void updateName_fixingOwnCapitalisation_succeeds() {
        Product product = new Product("widget", 10, 5.0);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.existsByNameIgnoreCaseAndIdNot("Widget", 1L)).thenReturn(false);
        when(productRepository.save(product)).thenReturn(product);

        Product result = productService.updateName(1L, "Widget");

        assertThat(result.getName()).isEqualTo("Widget");
    }

    @Test
    void deleteById_withExistingId_deletesAndReturnsTrue() {
        when(productRepository.existsById(1L)).thenReturn(true);

        boolean result = productService.deleteById(1L);

        assertThat(result).isTrue();
        verify(productRepository, times(1)).deleteById(1L);
    }

    @Test
    void deleteById_withMissingId_returnsFalseWithoutDeleting() {
        when(productRepository.existsById(1L)).thenReturn(false);

        boolean result = productService.deleteById(1L);

        assertThat(result).isFalse();
        verify(productRepository, never()).deleteById(1L);
    }

    @Test
    void findLowStock_withThreshold_returnsRepositoryResult() {
        Product product = new Product("Widget", 2, 5.0);
        when(productRepository.findByQuantityLessThan(5)).thenReturn(List.of(product));

        assertThat(productService.findLowStock(5)).containsExactly(product);
    }

    @Test
    void searchByName_withMatch_returnsRepositoryResult() {
        Product product = new Product("Widget", 10, 5.0);
        when(productRepository.findByNameContainingIgnoreCase("wid")).thenReturn(List.of(product));

        assertThat(productService.searchByName("wid")).containsExactly(product);
    }

    @Test
    void updateQuantity_withExistingId_updatesAndReturnsProduct() {
        Product product = new Product("Widget", 10, 5.0);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(product)).thenReturn(product);

        Product result = productService.updateQuantity(1L, 50);

        assertThat(result.getQuantity()).isEqualTo(50);
    }

    @Test
    void updateQuantity_withMissingId_throwsEntityNotFoundException() {
        when(productRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.updateQuantity(1L, 50))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Product with ID 1 not found.");
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
    void adjustQuantity_withDeltaBelowZero_throwsIllegalStateException() {
        Product product = new Product("Widget", 3, 5.0);
        when(productRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> productService.adjustQuantity(1L, -5))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Adjustment of -5 would result in negative stock for product 1 (current: 3).");
    }

    @Test
    void adjustQuantity_withMissingId_throwsEntityNotFoundException() {
        when(productRepository.findByIdForUpdate(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.adjustQuantity(1L, 5))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Product with ID 1 not found.");
    }

    @Test
    void updatePrice_withExistingId_updatesAndReturnsProduct() {
        Product product = new Product("Widget", 10, 5.0);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(product)).thenReturn(product);

        Product result = productService.updatePrice(1L, BigDecimal.TEN);

        assertThat(result.getPurchasePrice()).isEqualByComparingTo(BigDecimal.TEN);
    }

    @Test
    void updatePrice_withMissingId_throwsEntityNotFoundException() {
        when(productRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.updatePrice(1L, BigDecimal.TEN))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Product with ID 1 not found.");
    }

    @Test
    void updateName_withExistingId_updatesAndReturnsProduct() {
        Product product = new Product("Widget", 10, 5.0);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(productRepository.save(product)).thenReturn(product);

        Product result = productService.updateName(1L, "Gadget");

        assertThat(result.getName()).isEqualTo("Gadget");
    }

    @Test
    void updateName_withMissingId_throwsEntityNotFoundException() {
        when(productRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.updateName(1L, "Gadget"))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Product with ID 1 not found.");
    }

    @Test
    void getTotalStockValue_withProducts_returnsRepositoryResult() {
        when(productRepository.calculateTotalStockValue()).thenReturn(123.45);

        assertThat(productService.getTotalStockValue()).isEqualTo(123.45);
    }
}
