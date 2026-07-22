package com.stocks.stockease.invoice.internal;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductChangedEvent;
import com.stocks.stockease.security.User;
import com.stocks.stockease.supplier.SupplierDeletedEvent;

/** Tests for {@link OpenInvoiceDeletionVeto} covering every veto branch and the ignored-field path. */
@ExtendWith(MockitoExtension.class)
class OpenInvoiceDeletionVetoTest {

    private InvoiceRepository invoiceRepository;
    private InvoiceItemRepository invoiceItemRepository;
    private OpenInvoiceDeletionVeto veto;

    @BeforeEach
    void setUp() {
        invoiceRepository = mock(InvoiceRepository.class);
        invoiceItemRepository = mock(InvoiceItemRepository.class);
        veto = new OpenInvoiceDeletionVeto(invoiceRepository, invoiceItemRepository);
    }

    private static Product product() {
        Product product = new Product("Widget", 10, 5.0);
        product.setId(7L);
        return product;
    }

    private static ProductChangedEvent productEvent(ProductChangedEvent.Field field) {
        return new ProductChangedEvent(product(), new User("editor", "hash", "ROLE_ADMIN"), field, null, null);
    }

    @Test
    void onSupplierDeleted_withOpenInvoices_throwsIllegalStateException() {
        when(invoiceRepository.existsBySupplierIdAndStatus(1L, InvoiceStatus.OPEN)).thenReturn(true);

        assertThatThrownBy(() -> veto.onSupplierDeleted(new SupplierDeletedEvent(1L, "Acme")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Cannot delete supplier 'Acme': open invoices exist.");
    }

    @Test
    void onSupplierDeleted_withoutOpenInvoices_doesNotThrow() {
        when(invoiceRepository.existsBySupplierIdAndStatus(1L, InvoiceStatus.OPEN)).thenReturn(false);

        assertThatCode(() -> veto.onSupplierDeleted(new SupplierDeletedEvent(1L, "Acme")))
                .doesNotThrowAnyException();
    }

    @Test
    void onProductChanged_deletedOnOpenInvoice_throwsIllegalStateException() {
        when(invoiceItemRepository.existsByProductIdAndInvoiceStatus(7L, InvoiceStatus.OPEN)).thenReturn(true);

        assertThatThrownBy(() -> veto.onProductChanged(productEvent(ProductChangedEvent.Field.DELETED)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Cannot delete product 'Widget': it appears on an open invoice.");
    }

    @Test
    void onProductChanged_deletedWithoutOpenInvoice_doesNotThrow() {
        when(invoiceItemRepository.existsByProductIdAndInvoiceStatus(7L, InvoiceStatus.OPEN)).thenReturn(false);

        assertThatCode(() -> veto.onProductChanged(productEvent(ProductChangedEvent.Field.DELETED)))
                .doesNotThrowAnyException();
    }

    @Test
    void onProductChanged_withNonDeletedField_neverQueriesRepositories() {
        veto.onProductChanged(productEvent(ProductChangedEvent.Field.NAME));

        verify(invoiceItemRepository, never()).existsByProductIdAndInvoiceStatus(anyLong(), any());
        verify(invoiceRepository, never()).existsBySupplierIdAndStatus(anyLong(), any());
    }
}
