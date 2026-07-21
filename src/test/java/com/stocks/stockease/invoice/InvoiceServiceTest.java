package com.stocks.stockease.invoice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import com.stocks.stockease.invoice.internal.InvoiceItemRepository;

import jakarta.persistence.EntityNotFoundException;

/** Tests for {@link InvoiceService} covering item lookup and the return-registration cap. */
@ExtendWith(MockitoExtension.class)
class InvoiceServiceTest {

    private InvoiceItemRepository invoiceItemRepository;
    private InvoiceService invoiceService;

    @BeforeEach
    void setUp() {
        invoiceItemRepository = mock(InvoiceItemRepository.class);
        invoiceService = new InvoiceService(invoiceItemRepository);
    }

    private static InvoiceItem itemWith(int quantity, int returnedQty) {
        InvoiceItem item = new InvoiceItem();
        item.setQuantity(quantity);
        item.setReturnedQty(returnedQty);
        item.setUnitPrice(BigDecimal.TEN);
        return item;
    }

    @Test
    void findItemById_withExistingId_returnsItem() {
        InvoiceItem item = itemWith(5, 0);
        when(invoiceItemRepository.findById(1L)).thenReturn(Optional.of(item));

        assertThat(invoiceService.findItemById(1L)).contains(item);
    }

    @Test
    void findItemById_withMissingId_returnsEmpty() {
        when(invoiceItemRepository.findById(1L)).thenReturn(Optional.empty());

        assertThat(invoiceService.findItemById(1L)).isEmpty();
    }

    @Test
    void registerReturn_withinRemainingQuantity_incrementsAndSaves() {
        InvoiceItem item = itemWith(5, 1);
        when(invoiceItemRepository.findById(1L)).thenReturn(Optional.of(item));
        when(invoiceItemRepository.save(item)).thenReturn(item);

        InvoiceItem result = invoiceService.registerReturn(1L, 2);

        assertThat(result.getReturnedQty()).isEqualTo(3);
    }

    @Test
    void registerReturn_exceedingRemainingQuantity_throwsIllegalStateException() {
        InvoiceItem item = itemWith(5, 4);
        when(invoiceItemRepository.findById(1L)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> invoiceService.registerReturn(1L, 2))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("exceeds remaining returnable quantity");
    }

    @Test
    void registerReturn_withZeroQuantity_throwsIllegalArgumentException() {
        InvoiceItem item = itemWith(5, 0);
        when(invoiceItemRepository.findById(1L)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> invoiceService.registerReturn(1L, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Return quantity must be positive.");
    }

    @Test
    void registerReturn_withMissingItem_throwsEntityNotFoundException() {
        when(invoiceItemRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invoiceService.registerReturn(1L, 1))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Invoice item with ID 1 not found.");
    }
}
