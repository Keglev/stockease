package com.stocks.stockease.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

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

/*
 * Contract: the plain read paths - getAllProducts, getPagedProducts and findById. What is
 * specified here is only that each hands the caller what the repository returned, unaltered and
 * unreordered, and that a missing row surfaces as an empty Optional rather than a null or a
 * throw. There is no rule to state beyond that, which is why this file is short.
 *
 * searchByName has no unit test any more, and that is the #140 rule rather than an omission.
 * The search is now a Specification the repository executes, so everything worth asserting -
 * which tokens match, against which columns, in what order, under the cap, excluding
 * soft-deleted rows - happens inside the database. A mock here could only restate the stub it
 * was given. ProductSearchIntegrationTest is where it moved.
 *
 * Out of scope: every path that writes. Creation, deletion and restore are in
 * ProductLifecycleServiceTest, attribute edits in ProductAttributeUpdateServiceTest, and stock
 * quantity, the everStocked flag and the low-stock query in ProductStockServiceTest.
 */
@ExtendWith(MockitoExtension.class)
class ProductQueryServiceTest {

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
}
