package com.stocks.stockease.audit.internal;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.internal.ProductRepository;
import com.stocks.stockease.audit.ProductChangeLog;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.audit.ChangedField;
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
        Product product = productRepository.saveAndFlush(withSku(new Product("Widget", 10, 5.0), "TST-LOG-1"));
        User user = userRepository.saveAndFlush(new User("logger", "hash", "ROLE_ADMIN"));

        ProductChangeLog log = new ProductChangeLog(null, product, user,
                ChangedField.PURCHASE_PRICE, "5.00", "6.00", null);

        ProductChangeLog saved = productChangeLogRepository.saveAndFlush(log);

        assertThat(saved.getId()).isNotNull();
    }

    @Test
    void persistChangeLog_deleteEvent_allowsNullValues() {
        Product product = productRepository.saveAndFlush(withSku(new Product("Widget", 10, 5.0), "TST-LOG-2"));
        User user = userRepository.saveAndFlush(new User("logger", "hash", "ROLE_ADMIN"));

        ProductChangeLog log = new ProductChangeLog(null, product, user,
                ChangedField.DELETED, null, null, null);

        ProductChangeLog saved = productChangeLogRepository.saveAndFlush(log);

        assertThat(saved.getId()).isNotNull();
    }

    /** The SKU is no longer generated on persist, so every fixture has to carry its own. */
    private static Product withSku(Product product, String sku) {
        product.setSku(sku);
        return product;
    }
}
