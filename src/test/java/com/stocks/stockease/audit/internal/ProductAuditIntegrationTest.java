package com.stocks.stockease.audit.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Comparator;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.audit.ChangedField;
import com.stocks.stockease.audit.ProductChangeLog;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.product.internal.ProductRepository;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Tests that product changes reach the change log through the real event pipeline.
 * The listener is synchronous, so its rows are written inside this test's transaction and visible to it.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ProductAuditIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ProductService productService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductChangeLogRepository productChangeLogRepository;

    @Autowired
    private UserRepository userRepository;

    private User user;

    @BeforeEach
    void setUp() {
        user = userRepository.findByUsername("audit-tester")
                .orElseGet(() -> userRepository.saveAndFlush(new User("audit-tester", "hash", "ROLE_ADMIN")));
    }

    /** Change log rows for one product, oldest first. */
    private List<ProductChangeLog> logFor(Long productId) {
        return productChangeLogRepository.findAll().stream()
                .filter(entry -> entry.getProduct().getId().equals(productId))
                .sorted(Comparator.comparing(ProductChangeLog::getId))
                .toList();
    }

    @Test
    void updateName_writesOneNameRowWithOldAndNewValues() {
        Product product = productRepository.saveAndFlush(new Product("Audit Rename Before", 10, 5.0));

        productService.updateName(product.getId(), "Audit Rename After", user);

        List<ProductChangeLog> entries = logFor(product.getId());
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).getField()).isEqualTo(ChangedField.NAME);
        assertThat(entries.get(0).getOldValue()).isEqualTo("Audit Rename Before");
        assertThat(entries.get(0).getNewValue()).isEqualTo("Audit Rename After");
        assertThat(entries.get(0).getUser().getId()).isEqualTo(user.getId());
    }

    @Test
    void deleteThenRestore_writesDeletedThenRestoredRows() {
        Product product = productRepository.saveAndFlush(new Product("Audit Delete Restore", 10, 5.0));

        productService.deleteById(product.getId(), user);
        productService.restore(product.getId(), user);

        assertThat(logFor(product.getId()))
                .extracting(ProductChangeLog::getField)
                .containsExactly(ChangedField.DELETED, ChangedField.RESTORED);
        assertThat(productRepository.findById(product.getId())).isPresent();
    }

    @Test
    void restore_blockedByLiveNameConflict_writesNoRestoredRow() {
        Product product = productRepository.saveAndFlush(new Product("Audit Conflict Name", 10, 5.0));
        productService.deleteById(product.getId(), user);
        // flush the soft delete first: within one flush Hibernate orders inserts before updates, so the
        // new row would otherwise hit the partial name index before the old one is marked deleted
        productRepository.flush();
        productRepository.saveAndFlush(new Product("Audit Conflict Name", 3, 5.0));

        assertThatThrownBy(() -> productService.restore(product.getId(), user))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Cannot restore: a live product named");

        assertThat(logFor(product.getId()))
                .extracting(ProductChangeLog::getField)
                .containsExactly(ChangedField.DELETED);
    }
}
