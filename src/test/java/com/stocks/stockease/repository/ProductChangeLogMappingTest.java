package com.stocks.stockease.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.model.Product;
import com.stocks.stockease.model.ProductChangeLog;
import com.stocks.stockease.model.User;
import com.stocks.stockease.model.enums.ChangedField;
import com.stocks.stockease.support.AbstractIntegrationTest;

/** Tests for {@link ProductChangeLog} JPA mapping. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ProductChangeLogMappingTest extends AbstractIntegrationTest {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductChangeLogRepository productChangeLogRepository;

    @Test
    void persistChangeLog_priceChange_persistsWithGeneratedId() {
        Product product = productRepository.saveAndFlush(new Product("Widget", 10, 5.0));
        User user = userRepository.saveAndFlush(new User("logger", "hash", "ROLE_ADMIN"));

        ProductChangeLog log = new ProductChangeLog(null, product, user,
                ChangedField.PURCHASE_PRICE, "5.00", "6.00", null);

        ProductChangeLog saved = productChangeLogRepository.saveAndFlush(log);

        assertThat(saved.getId()).isNotNull();
    }

    @Test
    void persistChangeLog_deleteEvent_allowsNullValues() {
        Product product = productRepository.saveAndFlush(new Product("Widget", 10, 5.0));
        User user = userRepository.saveAndFlush(new User("logger", "hash", "ROLE_ADMIN"));

        ProductChangeLog log = new ProductChangeLog(null, product, user,
                ChangedField.DELETED, null, null, null);

        ProductChangeLog saved = productChangeLogRepository.saveAndFlush(log);

        assertThat(saved.getId()).isNotNull();
    }
}
