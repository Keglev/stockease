package com.stocks.stockease.product.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.product.Product;
import com.stocks.stockease.support.AbstractIntegrationTest;

/** Integration tests for soft delete semantics and the partial unique SKU index, against real PostgreSQL. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SoftDeleteIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void deleteProduct_viaRepository_setsDeletedAtInsteadOfRemoving() {
        Product product = productRepository.saveAndFlush(new Product("Widget", 10, 5.0));
        Long id = product.getId();

        productRepository.delete(product);
        productRepository.flush();

        Integer rowsWithDeletedAt = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM product WHERE id = ? AND deleted_at IS NOT NULL", Integer.class, id);
        assertThat(rowsWithDeletedAt).isEqualTo(1);
        assertThat(productRepository.findById(id)).isEmpty();
    }

    @Test
    void persistProduct_duplicateActiveSku_rejected() {
        Product first = new Product("Widget", 10, 5.0);
        first.setSku("SKU-DUP-1");
        productRepository.saveAndFlush(first);

        Product second = new Product("Widget", 10, 5.0);
        second.setSku("SKU-DUP-1");

        assertThatThrownBy(() -> productRepository.saveAndFlush(second))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void softDeleteProduct_thenRecreateSameSku_succeeds() {
        Product first = new Product("Widget", 10, 5.0);
        first.setSku("SKU-RE-1");
        productRepository.saveAndFlush(first);
        productRepository.delete(first);
        productRepository.flush();

        Product second = new Product("Widget", 10, 5.0);
        second.setSku("SKU-RE-1");
        Product saved = productRepository.saveAndFlush(second);

        assertThat(saved.getId()).isNotNull();
    }
}
