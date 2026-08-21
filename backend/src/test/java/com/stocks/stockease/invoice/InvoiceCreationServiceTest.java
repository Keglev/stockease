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
import com.stocks.stockease.shared.ApiErrorCodes;
import com.stocks.stockease.shared.InvalidRequestException;
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
    void createInvoice_withNullType_throwsInvalidRequestException() {
        assertThatThrownBy(() -> invoiceService.createInvoice(
                command(null, null, null, line(3L, 1, BigDecimal.TEN))))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessage("Invoice type is required.")
                .extracting(thrown -> ((InvalidRequestException) thrown).getCode())
                .isEqualTo(ApiErrorCodes.INVOICE_TYPE_REQUIRED);
    }

    @Test
    void createInvoice_withNullDueDate_throwsInvalidRequestException() {
        CreateInvoiceCommand command = new CreateInvoiceCommand(InvoiceType.SALE, "TST-SVC-3", null, null, null,
                null, null, List.of(line(3L, 1, BigDecimal.TEN)));

        assertThatThrownBy(() -> invoiceService.createInvoice(command))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessage("Due date is required.")
                .extracting(thrown -> ((InvalidRequestException) thrown).getCode())
                .isEqualTo(ApiErrorCodes.INVOICE_DUE_DATE_REQUIRED);
    }

    @Test
    void createInvoice_withEmptyItems_throwsInvalidRequestException() {
        assertThatThrownBy(() -> invoiceService.createInvoice(command(InvoiceType.SALE, null, null)))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessage("An invoice requires at least one item.")
                .extracting(thrown -> ((InvalidRequestException) thrown).getCode())
                .isEqualTo(ApiErrorCodes.INVOICE_REQUIRES_ITEM);
    }

    @Test
    void createInvoice_withBlankInvoiceNumber_throwsInvalidRequestException() {
        // The service's own check, which the request record's @NotBlank shadows over HTTP. This is
        // the only seat from which its code can be observed at all (ADR 041, ruling R47).
        CreateInvoiceCommand command = new CreateInvoiceCommand(InvoiceType.SALE, "  ", null, null,
                LocalDate.now(), null, null, List.of(line(3L, 1, BigDecimal.TEN)));

        assertThatThrownBy(() -> invoiceService.createInvoice(command))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessage("Invoice number is required.")
                .extracting(thrown -> ((InvalidRequestException) thrown).getCode())
                .isEqualTo(ApiErrorCodes.INVOICE_NUMBER_REQUIRED);
    }

    @Test
    void createInvoice_purchaseWithoutSupplier_throwsInvalidRequestException() {
        assertThatThrownBy(() -> invoiceService.createInvoice(
                command(InvoiceType.PURCHASE, null, null, line(3L, 1, BigDecimal.TEN))))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessage("Purchase invoices require a supplier and no customer.")
                .extracting(thrown -> ((InvalidRequestException) thrown).getCode())
                .isEqualTo(ApiErrorCodes.PURCHASE_INVOICE_PARTY_MISMATCH);
    }

    @Test
    void createInvoice_purchaseWithCustomer_throwsInvalidRequestException() {
        assertThatThrownBy(() -> invoiceService.createInvoice(
                command(InvoiceType.PURCHASE, 2L, 9L, line(3L, 1, BigDecimal.TEN))))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessage("Purchase invoices require a supplier and no customer.")
                .extracting(thrown -> ((InvalidRequestException) thrown).getCode())
                .isEqualTo(ApiErrorCodes.PURCHASE_INVOICE_PARTY_MISMATCH);
    }

    @Test
    void createInvoice_saleWithSupplier_throwsInvalidRequestException() {
        assertThatThrownBy(() -> invoiceService.createInvoice(
                command(InvoiceType.SALE, 2L, null, line(3L, 1, BigDecimal.TEN))))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessage("Sale invoices must not reference a supplier.")
                .extracting(thrown -> ((InvalidRequestException) thrown).getCode())
                .isEqualTo(ApiErrorCodes.SALE_INVOICE_PARTY_MISMATCH);
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
    void createInvoice_withNonPositiveQuantity_throwsInvalidRequestException() {
        assertThatThrownBy(() -> invoiceService.createInvoice(
                command(InvoiceType.SALE, null, null, line(3L, 0, BigDecimal.TEN))))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessage("Item quantity must be positive.")
                .extracting(thrown -> ((InvalidRequestException) thrown).getCode())
                .isEqualTo(ApiErrorCodes.ITEM_QUANTITY_NOT_POSITIVE);
    }

    @Test
    void createInvoice_withNonPositiveUnitPrice_throwsInvalidRequestException() {
        assertThatThrownBy(() -> invoiceService.createInvoice(
                command(InvoiceType.SALE, null, null, line(3L, 1, BigDecimal.ZERO))))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessage("Item unit price must be positive.")
                .extracting(thrown -> ((InvalidRequestException) thrown).getCode())
                .isEqualTo(ApiErrorCodes.ITEM_UNIT_PRICE_NOT_POSITIVE);
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
