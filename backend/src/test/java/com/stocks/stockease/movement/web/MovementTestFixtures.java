package com.stocks.stockease.movement.web;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Objects;

import org.jspecify.annotations.NonNull;
import org.springframework.http.MediaType;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.stocks.stockease.invoice.InvoiceItem;
import com.stocks.stockease.movement.MovementReason;
import com.stocks.stockease.movement.MovementRemark;
import com.stocks.stockease.movement.StockMovement;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.security.User;

/** Shared entity builders and request helpers for the movement controller slice tests. */
final class MovementTestFixtures {

    static final LocalDateTime CREATED_AT = LocalDateTime.of(2026, 1, 2, 3, 4);

    private MovementTestFixtures() {
    }

    /** As {@link #movement(MovementReason, Long)}, plus the loss remark the response carries. */
    static StockMovement movement(MovementReason reason, Long invoiceItemId, MovementRemark remark) {
        StockMovement movement = movement(reason, invoiceItemId);
        movement.setRemark(remark);
        return movement;
    }

    /** Builds a recorded movement with product, user and - when linked - invoice item initialized. */
    static StockMovement movement(MovementReason reason, Long invoiceItemId) {
        Product product = new Product("Widget", 10, 5.0);
        product.setId(3L);
        User user = new User("admin", "hash", "ROLE_ADMIN");
        user.setId(11L);

        StockMovement movement = new StockMovement();
        movement.setId(5L);
        movement.setProduct(product);
        movement.setUser(user);
        movement.setType(reason.getType());
        movement.setReason(reason);
        movement.setQuantity(2);
        movement.setUnitCost(new BigDecimal("7.50"));
        movement.setCreatedAt(CREATED_AT);
        if (invoiceItemId != null) {
            InvoiceItem item = new InvoiceItem();
            item.setId(invoiceItemId);
            movement.setInvoiceItem(item);
        }
        return movement;
    }

    /** A standalone movement body for the given reason, carrying a unit cost. */
    static String movementBody(MovementReason reason) {
        return "{\"productId\": 3, \"reason\": \"" + reason + "\", \"quantity\": 2, \"unitCost\": 7.50}";
    }

    /** A return body for the given reason, linked to invoice item 4. */
    static String returnBody(MovementReason reason) {
        return "{\"invoiceItemId\": 4, \"productId\": 3, \"reason\": \"" + reason + "\", \"quantity\": 2}";
    }

    static @NonNull MediaType applicationJson() {
        return Objects.requireNonNull(MediaType.APPLICATION_JSON);
    }

    static @NonNull RequestPostProcessor csrfToken() {
        return Objects.requireNonNull(csrf());
    }
}
