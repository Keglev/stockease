package com.stocks.stockease.movement.internal;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.internal.ProductRepository;
import com.stocks.stockease.movement.StockMovement;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.movement.MovementReason;
import com.stocks.stockease.movement.MovementType;
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
