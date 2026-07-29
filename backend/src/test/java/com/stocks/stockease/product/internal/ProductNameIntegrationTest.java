package com.stocks.stockease.product.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.product.Product;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Tests the partial unique index on the lowercased product name: uniqueness is case-insensitive
 * and applies to live rows only, so a soft-deleted product's name can be reused.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ProductNameIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ProductRepository productRepository;

    @Test
    void persistProduct_nameDifferingOnlyByCase_rejected() {
        productRepository.saveAndFlush(withSku(new Product("Name Case Widget", 10, 5.0), "TST-NAME-1"));

        // distinct SKU so the violation can only come from the name index, not the SKU index
        Product second = withSku(new Product("NAME CASE WIDGET", 10, 5.0), "TST-NAME-2");

        assertThatThrownBy(() -> productRepository.saveAndFlush(second))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void softDeleteProduct_thenRecreateSameName_succeeds() {
        Product first = productRepository.saveAndFlush(
                withSku(new Product("Name Reuse Widget", 10, 5.0), "TST-NAME-3"));
        productRepository.delete(first);
        productRepository.flush();

        Product saved = productRepository.saveAndFlush(
                withSku(new Product("Name Reuse Widget", 10, 5.0), "TST-NAME-4"));

        assertThat(saved.getId()).isNotNull();
    }

    @Test
    void persistProducts_withDistinctNames_bothPersist() {
        Product first = productRepository.saveAndFlush(
                withSku(new Product("Name Distinct One", 10, 5.0), "TST-NAME-5"));

        Product second = productRepository.saveAndFlush(
                withSku(new Product("Name Distinct Two", 10, 5.0), "TST-NAME-6"));

        assertThat(first.getId()).isNotNull();
        assertThat(second.getId()).isNotNull();
    }

    /** The SKU is no longer generated on persist, so every fixture has to carry its own. */
    private static Product withSku(Product product, String sku) {
        product.setSku(sku);
        return product;
    }
}
