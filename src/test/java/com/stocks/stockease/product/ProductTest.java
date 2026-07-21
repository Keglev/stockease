package com.stocks.stockease.product;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

/** Tests for {@link Product} covering the computed total value. */
class ProductTest {

    @Test
    void getTotalValue_withQuantityAndPurchasePrice_returnsQuantityTimesPrice() {
        Product product = new Product("Widget", 10, 5.0);

        assertThat(product.getTotalValue()).isEqualByComparingTo(BigDecimal.valueOf(50.0));
    }
}
