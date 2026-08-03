package com.stocks.stockease.product.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.product.Product;
import com.stocks.stockease.support.AbstractIntegrationTest;

/** Tests for {@link ProductRepository} covering how the sku column behaves on persist. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ProductRepositoryTest extends AbstractIntegrationTest {

    @Autowired
    private ProductRepository productRepository;

    @Test
    void save_withoutSku_isRejectedRatherThanGenerated() {
        // the @PrePersist generator is gone (ADR 018): a missing SKU is now a NOT NULL violation
        // instead of a silently invented identifier, and validation stops it long before this point
        Product product = new Product("Widget", 10, 5.0);

        assertThatThrownBy(() -> productRepository.saveAndFlush(product))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void save_withOperatorAssignedSku_persistsItUnchanged() {
        Product product = new Product("Widget", 10, 5.0);
        product.setSku("SKU-OWN-1");

        Product saved = productRepository.saveAndFlush(product);

        assertThat(saved.getSku()).isEqualTo("SKU-OWN-1");
    }

    @Test
    void findAllDeleted_returnsDeletedRows_orderedByNameIgnoringCase() {
        // mixed capitalization proves the ordering is case-insensitive rather than byte-wise, which
        // would sort every uppercase name ahead of every lowercase one
        productRepository.saveAndFlush(deleted(product("zinc plate", "SKU-DEL-1")));
        productRepository.saveAndFlush(deleted(product("Alpha Bracket", "SKU-DEL-2")));
        productRepository.saveAndFlush(deleted(product("mid Clamp", "SKU-DEL-3")));

        // Scoped to this test's own SKUs: the suite shares one container and other classes commit
        // soft-deleted products, so asserting on the whole bin would couple this to their fixtures.
        // Relative order within the result is what the ORDER BY has to get right.
        assertThat(ownRows(productRepository.findAllDeleted()))
                .containsExactly("Alpha Bracket", "mid Clamp", "zinc plate");
    }

    @Test
    void findAllDeleted_liveProduct_isNotListed() {
        productRepository.saveAndFlush(product("Only Live", "SKU-DEL-4"));

        assertThat(ownRows(productRepository.findAllDeleted())).isEmpty();
    }

    /** Names of the rows this test class created, in the order the query returned them. */
    private static List<String> ownRows(List<Product> found) {
        return found.stream()
                .filter(product -> product.getSku().startsWith("SKU-DEL-"))
                .map(Product::getName)
                .toList();
    }

    private static Product product(String name, String sku) {
        Product product = new Product(name, 10, 5.0);
        product.setSku(sku);
        return product;
    }

    private static Product deleted(Product product) {
        product.setDeletedAt(LocalDateTime.now());
        return product;
    }
}
