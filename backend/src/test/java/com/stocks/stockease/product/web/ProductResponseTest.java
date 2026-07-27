package com.stocks.stockease.product.web;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

import com.stocks.stockease.product.Product;

/** Tests for {@link ProductResponse} covering the mapping and the total value derived at mapping time. */
class ProductResponseTest {

    @Test
    void from_withQuantityAndPurchasePrice_derivesQuantityTimesPrice() {
        Product product = new Product("Widget", 10, 5.0);

        assertThat(ProductResponse.from(product).totalValue()).isEqualByComparingTo(BigDecimal.valueOf(50.0));
    }

    @Test
    void from_withPersistedProduct_copiesEveryClientField() {
        Product product = new Product("Widget", 10, 5.0);
        product.setId(1L);
        product.setSku("SKU-1");
        product.setCreatedAt(LocalDateTime.of(2026, 1, 2, 3, 4));

        ProductResponse response = ProductResponse.from(product);

        assertThat(response.id()).isEqualTo(1L);
        assertThat(response.name()).isEqualTo("Widget");
        assertThat(response.sku()).isEqualTo("SKU-1");
        assertThat(response.quantity()).isEqualTo(10);
        assertThat(response.purchasePrice()).isEqualByComparingTo("5.0");
        assertThat(response.createdAt()).isEqualTo(LocalDateTime.of(2026, 1, 2, 3, 4));
    }

    @Test
    void from_withZeroQuantity_derivesZeroTotalValue() {
        Product product = new Product("Widget", 0, 5.0);

        assertThat(ProductResponse.from(product).totalValue()).isEqualByComparingTo("0");
    }

    @Test
    void from_withUnsetPrice_leavesTotalValueNull() {
        // a half-built product must map rather than blow up; persisted rows always carry both operands
        Product product = new Product();
        product.setQuantity(10);

        assertThat(ProductResponse.from(product).totalValue()).isNull();
    }
}
