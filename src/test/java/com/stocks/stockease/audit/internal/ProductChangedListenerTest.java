package com.stocks.stockease.audit.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;

import com.stocks.stockease.audit.ChangedField;
import com.stocks.stockease.audit.ProductChangeLog;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductChangedEvent;
import com.stocks.stockease.security.User;

/** Tests that {@link ProductChangedListener} maps each event field onto the persisted change log row. */
@ExtendWith(MockitoExtension.class)
class ProductChangedListenerTest {

    private ProductChangeLogRepository productChangeLogRepository;
    private ProductChangedListener listener;
    private Product product;
    private User user;

    @BeforeEach
    void setUp() {
        productChangeLogRepository = mock(ProductChangeLogRepository.class);
        listener = new ProductChangedListener(productChangeLogRepository);
        product = new Product("Widget", 10, 5.0);
        user = new User("editor", "hash", "ROLE_ADMIN");
    }

    /** Dispatches the event and returns the row handed to the repository. */
    private ProductChangeLog saved(ProductChangedEvent.Field field, String oldValue, String newValue) {
        listener.onProductChanged(new ProductChangedEvent(product, user, field, oldValue, newValue));
        ArgumentCaptor<ProductChangeLog> captor = ArgumentCaptor.forClass(ProductChangeLog.class);
        verify(productChangeLogRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void onProductChanged_nameEvent_savesNameRowWithBothValues() {
        ProductChangeLog entry = saved(ProductChangedEvent.Field.NAME, "Widget", "Gadget");

        assertThat(entry.getField()).isEqualTo(ChangedField.NAME);
        assertThat(entry.getOldValue()).isEqualTo("Widget");
        assertThat(entry.getNewValue()).isEqualTo("Gadget");
        assertThat(entry.getProduct()).isSameAs(product);
        assertThat(entry.getUser()).isSameAs(user);
    }

    @Test
    void onProductChanged_purchasePriceEvent_savesPurchasePriceRow() {
        ProductChangeLog entry = saved(ProductChangedEvent.Field.PURCHASE_PRICE, "5.00", "7.25");

        assertThat(entry.getField()).isEqualTo(ChangedField.PURCHASE_PRICE);
        assertThat(entry.getOldValue()).isEqualTo("5.00");
        assertThat(entry.getNewValue()).isEqualTo("7.25");
    }

    @Test
    void onProductChanged_deletedEvent_savesDeletedRowWithNullValues() {
        ProductChangeLog entry = saved(ProductChangedEvent.Field.DELETED, null, null);

        assertThat(entry.getField()).isEqualTo(ChangedField.DELETED);
        assertThat(entry.getOldValue()).isNull();
        assertThat(entry.getNewValue()).isNull();
    }

    @Test
    void onProductChanged_restoredEvent_savesRestoredRowWithNullValues() {
        ProductChangeLog entry = saved(ProductChangedEvent.Field.RESTORED, null, null);

        assertThat(entry.getField()).isEqualTo(ChangedField.RESTORED);
        assertThat(entry.getOldValue()).isNull();
        assertThat(entry.getNewValue()).isNull();
    }
}
