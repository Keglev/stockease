package com.stocks.stockease.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.model.Product;
import com.stocks.stockease.model.StockMovement;
import com.stocks.stockease.model.User;
import com.stocks.stockease.model.enums.MovementReason;
import com.stocks.stockease.model.enums.MovementType;
import com.stocks.stockease.support.AbstractIntegrationTest;

/** Tests for {@link StockMovement} JPA mapping and {@link MovementReason} direction binding. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class StockMovementMappingTest extends AbstractIntegrationTest {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StockMovementRepository stockMovementRepository;

    @Test
    void persistMovement_minimalSoldMovement_persistsWithGeneratedId() {
        Product product = productRepository.saveAndFlush(new Product("Widget", 10, 5.0));
        User user = userRepository.saveAndFlush(new User("mover", "hash", "ROLE_ADMIN"));

        StockMovement movement = new StockMovement(null, product, user, MovementType.DECREASE,
                MovementReason.SOLD, 2, null, BigDecimal.TEN, null, null);

        StockMovement saved = stockMovementRepository.saveAndFlush(movement);

        assertThat(saved.getId()).isNotNull();
    }

    @Test
    void movementReason_getType_returnsBoundDirection() {
        assertThat(MovementReason.PURCHASE.getType()).isEqualTo(MovementType.INCREASE);
        assertThat(MovementReason.SOLD.getType()).isEqualTo(MovementType.DECREASE);
    }
}
