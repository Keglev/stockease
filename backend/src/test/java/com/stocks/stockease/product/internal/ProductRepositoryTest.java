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
}
