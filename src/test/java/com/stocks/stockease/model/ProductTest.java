package com.stocks.stockease.model;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link Product} covering the null-guard branches in {@code updateTotalValue}.
 */
class ProductTest {

    @Test
    void setQuantity_withNullQuantity_setsTotalValueToZero() {
        Product product = new Product("Widget", 10, 5.0);

        product.setQuantity(null);

        // quantity == null short-circuits the && guard → totalValue defaults to 0.0
        assertThat(product.getTotalValue()).isEqualTo(0.0);
    }

    @Test
    void setPrice_withNullPrice_setsTotalValueToZero() {
        Product product = new Product("Widget", 10, 5.0);

        product.setPrice(null);

        // quantity is non-null but price == null → second null-guard fires → totalValue defaults to 0.0
        assertThat(product.getTotalValue()).isEqualTo(0.0);
    }
}
