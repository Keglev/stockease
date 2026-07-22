package com.stocks.stockease.invoice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import com.stocks.stockease.customer.Customer;
import com.stocks.stockease.customer.CustomerService;
import com.stocks.stockease.invoice.internal.InvoiceItemRepository;
import com.stocks.stockease.invoice.internal.InvoiceRepository;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;

import jakarta.persistence.EntityNotFoundException;

/** Tests for {@link InvoiceService} covering creation, closing, the return guards and deletion rules. */
@ExtendWith(MockitoExtension.class)
class InvoiceServiceTest {

    private InvoiceItemRepository invoiceItemRepository;
    private InvoiceRepository invoiceRepository;
    private ProductService productService;
    private SupplierService supplierService;
    private CustomerService customerService;
    private ApplicationEventPublisher eventPublisher;
    private InvoiceService invoiceService;
    private User user;

    @BeforeEach
    void setUp() {
        invoiceItemRepository = mock(InvoiceItemRepository.class);
        invoiceRepository = mock(InvoiceRepository.class);
        productService = mock(ProductService.class);
        supplierService = mock(SupplierService.class);
        customerService = mock(CustomerService.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        invoiceService = new InvoiceService(invoiceItemRepository, invoiceRepository, productService,
                supplierService, customerService, eventPublisher);
        user = new User("closer", "hash", "ROLE_ADMIN");
    }

    private static Product product(long id) {
        Product product = new Product("Widget", 10, 5.0);
        product.setId(id);
        return product;
    }

    private static Invoice invoiceWith(InvoiceStatus status, InvoiceType type) {
        Invoice invoice = new Invoice();
        invoice.setId(1L);
        invoice.setType(type);
        invoice.setStatus(status);
        return invoice;
    }

    /** Adds a line to {@code invoice} and returns it, mirroring the bidirectional link JPA would load. */
    private static InvoiceItem itemOn(Invoice invoice, long itemId, long productId, int quantity, int returnedQty) {
        InvoiceItem item = new InvoiceItem();
        item.setId(itemId);
        item.setInvoice(invoice);
        item.setProduct(product(productId));
        item.setQuantity(quantity);
        item.setUnitPrice(BigDecimal.TEN);
        item.setReturnedQty(returnedQty);
        invoice.getItems().add(item);
        return item;
    }

    private static InvoiceItem itemWith(int quantity, int returnedQty) {
        return itemOn(invoiceWith(InvoiceStatus.CLOSED, InvoiceType.PURCHASE), 1L, 1L, quantity, returnedQty);
    }

    private static CreateInvoiceCommand.ItemLine line(long productId, int quantity, BigDecimal unitPrice) {
        return new CreateInvoiceCommand.ItemLine(productId, quantity, unitPrice);
    }

    private static CreateInvoiceCommand command(InvoiceType type, Long supplierId, Long customerId,
            CreateInvoiceCommand.ItemLine... lines) {
        return new CreateInvoiceCommand(type, supplierId, customerId, LocalDate.now(), BigDecimal.ONE,
                BigDecimal.ONE, List.of(lines));
    }

    /** Makes {@code save} return its argument so creation tests can assert on the built graph. */
    private void stubSaveReturnsArgument() {
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(call -> call.getArgument(0));
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
    void createInvoice_purchaseWithSupplier_buildsOpenInvoiceWithItems() {
        when(supplierService.findById(2L)).thenReturn(Optional.of(new Supplier()));
        when(productService.findById(3L)).thenReturn(Optional.of(product(3L)));
        stubSaveReturnsArgument();

        Invoice result = invoiceService.createInvoice(
                command(InvoiceType.PURCHASE, 2L, null, line(3L, 4, BigDecimal.TEN)));

        assertThat(result.getStatus()).isEqualTo(InvoiceStatus.OPEN);
        assertThat(result.getSupplier()).isNotNull();
        assertThat(result.getItems()).hasSize(1);
        assertThat(result.getItems().get(0).getQuantity()).isEqualTo(4);
        assertThat(result.getItems().get(0).getReturnedQty()).isEqualTo(0);
    }

    @Test
    void createInvoice_saleWithCustomer_attachesCustomerAndNoSupplier() {
        when(customerService.findById(9L)).thenReturn(Optional.of(new Customer()));
        when(productService.findById(3L)).thenReturn(Optional.of(product(3L)));
        stubSaveReturnsArgument();

        Invoice result = invoiceService.createInvoice(
                command(InvoiceType.SALE, null, 9L, line(3L, 2, BigDecimal.TEN)));

        assertThat(result.getCustomer()).isNotNull();
        assertThat(result.getSupplier()).isNull();
        assertThat(result.getStatus()).isEqualTo(InvoiceStatus.OPEN);
    }

    @Test
    void createInvoice_saleWithoutCustomer_buildsAnonymousSale() {
        when(productService.findById(3L)).thenReturn(Optional.of(product(3L)));
        stubSaveReturnsArgument();

        Invoice result = invoiceService.createInvoice(
                command(InvoiceType.SALE, null, null, line(3L, 2, BigDecimal.TEN)));

        assertThat(result.getCustomer()).isNull();
        assertThat(result.getSupplier()).isNull();
        assertThat(result.getItems()).hasSize(1);
    }

    @Test
    void createInvoice_nullInterestAndFine_defaultToZero() {
        when(productService.findById(3L)).thenReturn(Optional.of(product(3L)));
        stubSaveReturnsArgument();
        CreateInvoiceCommand command = new CreateInvoiceCommand(InvoiceType.SALE, null, null, LocalDate.now(),
                null, null, List.of(line(3L, 2, BigDecimal.TEN)));

        Invoice result = invoiceService.createInvoice(command);

        assertThat(result.getInterestRate()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.getFineValue()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void createInvoice_withNullType_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> invoiceService.createInvoice(
                command(null, null, null, line(3L, 1, BigDecimal.TEN))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invoice type is required.");
    }

    @Test
    void createInvoice_withNullDueDate_throwsIllegalArgumentException() {
        CreateInvoiceCommand command = new CreateInvoiceCommand(InvoiceType.SALE, null, null, null,
                null, null, List.of(line(3L, 1, BigDecimal.TEN)));

        assertThatThrownBy(() -> invoiceService.createInvoice(command))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Due date is required.");
    }

    @Test
    void createInvoice_withEmptyItems_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> invoiceService.createInvoice(command(InvoiceType.SALE, null, null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("An invoice requires at least one item.");
    }

    @Test
    void createInvoice_purchaseWithoutSupplier_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> invoiceService.createInvoice(
                command(InvoiceType.PURCHASE, null, null, line(3L, 1, BigDecimal.TEN))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Purchase invoices require a supplier and no customer.");
    }

    @Test
    void createInvoice_purchaseWithCustomer_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> invoiceService.createInvoice(
                command(InvoiceType.PURCHASE, 2L, 9L, line(3L, 1, BigDecimal.TEN))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Purchase invoices require a supplier and no customer.");
    }

    @Test
    void createInvoice_saleWithSupplier_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> invoiceService.createInvoice(
                command(InvoiceType.SALE, 2L, null, line(3L, 1, BigDecimal.TEN))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Sale invoices must not reference a supplier.");
    }

    @Test
    void createInvoice_withMissingSupplier_throwsEntityNotFoundException() {
        when(supplierService.findById(2L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invoiceService.createInvoice(
                command(InvoiceType.PURCHASE, 2L, null, line(3L, 1, BigDecimal.TEN))))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Supplier with ID 2 not found.");
    }

    @Test
    void createInvoice_withMissingCustomer_throwsEntityNotFoundException() {
        when(customerService.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invoiceService.createInvoice(
                command(InvoiceType.SALE, null, 9L, line(3L, 1, BigDecimal.TEN))))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Customer with ID 9 not found.");
    }

    @Test
    void createInvoice_withNonPositiveQuantity_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> invoiceService.createInvoice(
                command(InvoiceType.SALE, null, null, line(3L, 0, BigDecimal.TEN))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Item quantity must be positive.");
    }

    @Test
    void createInvoice_withNonPositiveUnitPrice_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> invoiceService.createInvoice(
                command(InvoiceType.SALE, null, null, line(3L, 1, BigDecimal.ZERO))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Item unit price must be positive.");
    }

    @Test
    void createInvoice_withMissingProduct_throwsEntityNotFoundException() {
        when(productService.findById(3L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invoiceService.createInvoice(
                command(InvoiceType.SALE, null, null, line(3L, 1, BigDecimal.TEN))))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Product with ID 3 not found.");
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
    void close_alreadyClosedInvoice_throwsIllegalStateException() {
        Invoice invoice = invoiceWith(InvoiceStatus.CLOSED, InvoiceType.SALE);
        when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));

        assertThatThrownBy(() -> invoiceService.close(1L, user))
                .isInstanceOf(IllegalStateException.class)
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
    void registerReturn_withinRemainingQuantity_incrementsAndSaves() {
        InvoiceItem item = itemWith(5, 1);
        when(invoiceItemRepository.findById(1L)).thenReturn(Optional.of(item));
        when(invoiceItemRepository.save(item)).thenReturn(item);

        InvoiceItem result = invoiceService.registerReturn(1L, 2);

        assertThat(result.getReturnedQty()).isEqualTo(3);
    }

    @Test
    void registerReturn_againstOpenInvoice_throwsIllegalStateException() {
        InvoiceItem item = itemOn(invoiceWith(InvoiceStatus.OPEN, InvoiceType.PURCHASE), 1L, 1L, 5, 0);
        when(invoiceItemRepository.findById(1L)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> invoiceService.registerReturn(1L, 2))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Returns require a closed invoice.");
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

    @Test
    void deleteById_openInvoice_deletesViaRepository() {
        Invoice invoice = invoiceWith(InvoiceStatus.OPEN, InvoiceType.SALE);
        when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));

        invoiceService.deleteById(1L);

        verify(invoiceRepository).delete(invoice);
    }

    @Test
    void deleteById_closedInvoice_throwsIllegalStateException() {
        Invoice invoice = invoiceWith(InvoiceStatus.CLOSED, InvoiceType.SALE);
        when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));

        assertThatThrownBy(() -> invoiceService.deleteById(1L))
                .isInstanceOf(IllegalStateException.class)
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
