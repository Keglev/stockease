package com.stocks.stockease.invoice;

import static com.stocks.stockease.invoice.InvoiceTestFixtures.command;
import static com.stocks.stockease.invoice.InvoiceTestFixtures.line;
import static com.stocks.stockease.invoice.InvoiceTestFixtures.product;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import com.stocks.stockease.customer.Customer;
import com.stocks.stockease.customer.CustomerService;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;

import jakarta.persistence.EntityNotFoundException;

/*
 * Contract: InvoiceService.createInvoice - every gate a command must clear before an invoice
 * exists (type, due date, at least one item, the party rules each type imposes, positive
 * quantity and price, referenced supplier/customer/product resolving), and the shape of the
 * graph built once it clears them.
 *
 * Out of scope: everything that happens to an invoice after it exists. Closing, payment and
 * deletion are specified in InvoiceLifecycleServiceTest, returns in InvoiceReturnServiceTest.
 */
@ExtendWith(MockitoExtension.class)
class InvoiceCreationServiceTest {

    private InvoiceTestFixtures fixtures;
    private ProductService productService;
    private SupplierService supplierService;
    private CustomerService customerService;
    private InvoiceService invoiceService;

    @BeforeEach
    void setUp() {
        fixtures = new InvoiceTestFixtures();
        productService = fixtures.productService;
        supplierService = fixtures.supplierService;
        customerService = fixtures.customerService;
        invoiceService = fixtures.invoiceService;
    }

    private void stubSaveReturnsArgument() {
        fixtures.stubSaveReturnsArgument();
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
        CreateInvoiceCommand command = new CreateInvoiceCommand(InvoiceType.SALE, "TST-SVC-2", null, null,
                LocalDate.now(), null, null, List.of(line(3L, 2, BigDecimal.TEN)));

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
        CreateInvoiceCommand command = new CreateInvoiceCommand(InvoiceType.SALE, "TST-SVC-3", null, null, null,
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
}
