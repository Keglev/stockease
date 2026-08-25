package com.stocks.stockease.invoice;

import static com.stocks.stockease.invoice.InvoiceTestFixtures.invoiceWith;
import static com.stocks.stockease.invoice.InvoiceTestFixtures.itemOn;
import static com.stocks.stockease.invoice.InvoiceTestFixtures.itemWith;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import com.stocks.stockease.shared.MissingEntityException;
import com.stocks.stockease.invoice.internal.InvoiceItemRepository;
import com.stocks.stockease.invoice.internal.InvoiceRepository;
import com.stocks.stockease.shared.ApiErrorCodes;
import com.stocks.stockease.shared.InvalidRequestException;
import com.stocks.stockease.shared.InvoiceStateException;


/*
 * Contract: InvoiceService.registerReturn - the guards on returning units (the parent invoice
 * must be closed, the quantity positive, and never more than the line has left to give), and
 * the one aggregate-level consequence: the invoice flips to FULLY_RETURNED exactly when the
 * last outstanding unit across all its lines comes back.
 *
 * Out of scope: where the returned units go. This spec stops at the invoice aggregate; putting
 * stock back is the movement module's contract and is specified against that module.
 */
@ExtendWith(MockitoExtension.class)
class InvoiceReturnServiceTest {

    private InvoiceTestFixtures fixtures;
    private InvoiceItemRepository invoiceItemRepository;
    private InvoiceRepository invoiceRepository;
    private InvoiceService invoiceService;

    @BeforeEach
    void setUp() {
        fixtures = new InvoiceTestFixtures();
        invoiceItemRepository = fixtures.invoiceItemRepository;
        invoiceRepository = fixtures.invoiceRepository;
        invoiceService = fixtures.invoiceService;
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
    void registerReturn_againstOpenInvoice_throwsInvoiceStateException() {
        InvoiceItem item = itemOn(invoiceWith(InvoiceStatus.OPEN, InvoiceType.PURCHASE), 1L, 1L, 5, 0);
        when(invoiceItemRepository.findById(1L)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> invoiceService.registerReturn(1L, 2))
                .isInstanceOf(InvoiceStateException.class)
                .hasMessage("Returns require a closed invoice.")
                // The one place this code is proved wired. Its situation is latent behind the movement
                // service open-invoice guard, which answers first on the only calling path, so no wire
                // assertion can reach it (ADR 041).
                .extracting(thrown -> ((InvoiceStateException) thrown).getCode())
                .isEqualTo(ApiErrorCodes.RETURN_REQUIRES_CLOSED_INVOICE);
    }

    @Test
    void registerReturn_partialAcrossItems_leavesInvoiceClosed() {
        Invoice invoice = invoiceWith(InvoiceStatus.CLOSED, InvoiceType.PURCHASE);
        InvoiceItem first = itemOn(invoice, 1L, 1L, 5, 0);
        itemOn(invoice, 2L, 2L, 5, 0);
        when(invoiceItemRepository.findById(1L)).thenReturn(Optional.of(first));
        when(invoiceItemRepository.save(first)).thenReturn(first);

        invoiceService.registerReturn(1L, 5);

        assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.CLOSED);
        verify(invoiceRepository, never()).save(invoice);
    }

    @Test
    void registerReturn_lastOutstandingUnits_flipsInvoiceToFullyReturned() {
        Invoice invoice = invoiceWith(InvoiceStatus.CLOSED, InvoiceType.PURCHASE);
        itemOn(invoice, 2L, 2L, 5, 5);
        InvoiceItem last = itemOn(invoice, 1L, 1L, 5, 3);
        when(invoiceItemRepository.findById(1L)).thenReturn(Optional.of(last));
        when(invoiceItemRepository.save(last)).thenReturn(last);

        invoiceService.registerReturn(1L, 2);

        assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.FULLY_RETURNED);
        verify(invoiceRepository).save(invoice);
    }

    @Test
    void registerReturn_withItemlessInvoice_leavesStatusUnchanged() {
        Invoice invoice = invoiceWith(InvoiceStatus.CLOSED, InvoiceType.PURCHASE);
        InvoiceItem detached = itemOn(invoice, 1L, 1L, 5, 4);
        invoice.getItems().clear();
        when(invoiceItemRepository.findById(1L)).thenReturn(Optional.of(detached));
        when(invoiceItemRepository.save(detached)).thenReturn(detached);

        invoiceService.registerReturn(1L, 1);

        assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.CLOSED);
        verify(invoiceRepository, never()).save(invoice);
    }

    @Test
    void registerReturn_exceedingRemainingQuantity_throwsInvoiceStateException() {
        InvoiceItem item = itemWith(5, 4);
        when(invoiceItemRepository.findById(1L)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> invoiceService.registerReturn(1L, 2))
                .isInstanceOf(InvoiceStateException.class)
                .hasMessageContaining("exceeds remaining returnable quantity");
    }

    @Test
    void registerReturn_withZeroQuantity_throwsInvalidRequestException() {
        InvoiceItem item = itemWith(5, 0);
        when(invoiceItemRepository.findById(1L)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> invoiceService.registerReturn(1L, 0))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessage("Return quantity must be positive.")
                .extracting(thrown -> ((InvalidRequestException) thrown).getCode())
                .isEqualTo(ApiErrorCodes.RETURN_QUANTITY_NOT_POSITIVE);
    }

    @Test
    void registerReturn_withMissingItem_throwsEntityNotFoundException() {
        when(invoiceItemRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invoiceService.registerReturn(1L, 1))
                // The subtype, not the parent: the parent still answers uncoded for a not-found JPA
                // raises, and asserting it here would pass whether or not this site was migrated.
                .isInstanceOf(MissingEntityException.class)
                .hasMessage("Invoice item with ID 1 not found.")
                .extracting(thrown -> ((MissingEntityException) thrown).getCode())
                .isEqualTo(ApiErrorCodes.INVOICE_ITEM_NOT_FOUND);
    }
}
