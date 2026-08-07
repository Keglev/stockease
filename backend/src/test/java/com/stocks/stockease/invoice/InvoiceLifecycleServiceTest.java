package com.stocks.stockease.invoice;

import static com.stocks.stockease.invoice.InvoiceTestFixtures.invoiceWith;
import static com.stocks.stockease.invoice.InvoiceTestFixtures.itemOn;
import static com.stocks.stockease.invoice.InvoiceTestFixtures.itemWith;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import com.stocks.stockease.invoice.internal.InvoiceItemRepository;
import com.stocks.stockease.invoice.internal.InvoiceRepository;
import com.stocks.stockease.security.User;
import com.stocks.stockease.shared.InvoiceStateException;

import jakarta.persistence.EntityNotFoundException;

/*
 * Contract: what an invoice may do once it exists - close, markAsPaid and deleteById, each with
 * the state guard that decides whether the transition is allowed - plus the two read paths
 * (findItemById, findClosedBy) that report on invoices already in those states.
 *
 * Closing is the transition that leaves the module: it is the only one that publishes, so the
 * event's contents are asserted here rather than trusted to the listener's own tests.
 *
 * Out of scope: creation-time validation (InvoiceCreationServiceTest) and the return guards
 * (InvoiceReturnServiceTest), each of which owns the transition it triggers.
 */
@ExtendWith(MockitoExtension.class)
class InvoiceLifecycleServiceTest {

    private InvoiceTestFixtures fixtures;
    private InvoiceItemRepository invoiceItemRepository;
    private InvoiceRepository invoiceRepository;
    private ApplicationEventPublisher eventPublisher;
    private InvoiceService invoiceService;
    private User user;

    @BeforeEach
    void setUp() {
        fixtures = new InvoiceTestFixtures();
        invoiceItemRepository = fixtures.invoiceItemRepository;
        invoiceRepository = fixtures.invoiceRepository;
        eventPublisher = fixtures.eventPublisher;
        invoiceService = fixtures.invoiceService;
        user = fixtures.user;
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
    void findClosedBy_withInvoices_returnsRepositoryResult() {
        Invoice invoice = invoiceWith(InvoiceStatus.CLOSED, InvoiceType.SALE);
        when(invoiceRepository.findByClosedByIdOrderByClosedAtDesc(4L)).thenReturn(List.of(invoice));

        assertThat(invoiceService.findClosedBy(4L)).containsExactly(invoice);
    }

    @Test
    void close_openInvoice_stampsClosureAndPublishesOneLinePerItem() {
        Invoice invoice = invoiceWith(InvoiceStatus.OPEN, InvoiceType.SALE);
        itemOn(invoice, 7L, 3L, 4, 0);
        when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));

        Invoice result = invoiceService.close(1L, user);

        assertThat(result.getStatus()).isEqualTo(InvoiceStatus.CLOSED);
        assertThat(result.getClosedBy()).isSameAs(user);
        assertThat(result.getClosedAt()).isNotNull();
        ArgumentCaptor<InvoiceClosedEvent> captor = ArgumentCaptor.forClass(InvoiceClosedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertThat(captor.getValue().lines()).containsExactly(new InvoiceClosedEvent.Line(7L, 3L, 4));
        assertThat(captor.getValue().type()).isEqualTo(InvoiceType.SALE);
    }

    @Test
    void close_alreadyClosedInvoice_throwsInvoiceStateException() {
        Invoice invoice = invoiceWith(InvoiceStatus.CLOSED, InvoiceType.SALE);
        when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));

        assertThatThrownBy(() -> invoiceService.close(1L, user))
                .isInstanceOf(InvoiceStateException.class)
                .hasMessage("Only open invoices can be closed.");
        verify(eventPublisher, never()).publishEvent(any(InvoiceClosedEvent.class));
    }

    @Test
    void close_withMissingInvoice_throwsEntityNotFoundException() {
        when(invoiceRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invoiceService.close(1L, user))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Invoice with ID 1 not found.");
    }

    @Test
    void markAsPaid_unpaidInvoice_stampsPaidAtAndSaves() {
        Invoice invoice = invoiceWith(InvoiceStatus.CLOSED, InvoiceType.SALE);
        when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));
        when(invoiceRepository.save(invoice)).thenReturn(invoice);

        Invoice result = invoiceService.markAsPaid(1L);

        assertThat(result.getPaidAt()).isNotNull();
        verify(invoiceRepository).save(invoice);
    }

    @Test
    void markAsPaid_openInvoice_succeedsIndependentlyOfStatus() {
        Invoice invoice = invoiceWith(InvoiceStatus.OPEN, InvoiceType.SALE);
        when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));
        when(invoiceRepository.save(invoice)).thenReturn(invoice);

        Invoice result = invoiceService.markAsPaid(1L);

        assertThat(result.getPaidAt()).isNotNull();
        assertThat(result.getStatus()).isEqualTo(InvoiceStatus.OPEN);
    }

    @Test
    void markAsPaid_alreadyPaidInvoice_throwsInvoiceStateException() {
        Invoice invoice = invoiceWith(InvoiceStatus.CLOSED, InvoiceType.SALE);
        invoice.setPaidAt(LocalDateTime.now());
        when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));

        assertThatThrownBy(() -> invoiceService.markAsPaid(1L))
                .isInstanceOf(InvoiceStateException.class)
                .hasMessage("Invoice is already marked as paid.");
        verify(invoiceRepository, never()).save(invoice);
    }

    @Test
    void markAsPaid_withMissingInvoice_throwsEntityNotFoundException() {
        when(invoiceRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invoiceService.markAsPaid(1L))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Invoice with ID 1 not found.");
    }

    @Test
    void deleteById_openInvoice_deletesViaRepository() {
        Invoice invoice = invoiceWith(InvoiceStatus.OPEN, InvoiceType.SALE);
        when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));

        invoiceService.deleteById(1L);

        verify(invoiceRepository).delete(invoice);
    }

    @Test
    void deleteById_closedInvoice_throwsInvoiceStateException() {
        Invoice invoice = invoiceWith(InvoiceStatus.CLOSED, InvoiceType.SALE);
        when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));

        assertThatThrownBy(() -> invoiceService.deleteById(1L))
                .isInstanceOf(InvoiceStateException.class)
                .hasMessage("Only open invoices can be deleted.");
        verify(invoiceRepository, never()).delete(invoice);
    }

    @Test
    void deleteById_withMissingInvoice_throwsEntityNotFoundException() {
        when(invoiceRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invoiceService.deleteById(1L))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Invoice with ID 1 not found.");
    }
}
