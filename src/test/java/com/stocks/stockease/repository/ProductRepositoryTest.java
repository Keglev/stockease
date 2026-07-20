package com.stocks.stockease.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.model.Product;

/** Tests for {@link ProductRepository} covering the sku lifecycle callback on persist. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ProductRepositoryTest {

    @Autowired
    private ProductRepository productRepository;

    @Test
    void save_withoutSku_generatesSkuOnPersist() {
        Product product = new Product("Widget", 10, 5.0);

        Product saved = productRepository.saveAndFlush(product);

        assertThat(saved.getSku()).isNotBlank();
    }
}
