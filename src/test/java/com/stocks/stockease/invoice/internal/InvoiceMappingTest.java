package com.stocks.stockease.invoice.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.customer.Customer;
import com.stocks.stockease.customer.internal.CustomerRepository;
import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceItem;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.internal.ProductRepository;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.internal.SupplierRepository;
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.support.AbstractIntegrationTest;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

/** Tests for {@link Invoice}/{@link InvoiceItem} JPA mapping, including the item cascade. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class InvoiceMappingTest extends AbstractIntegrationTest {

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @PersistenceContext
    private EntityManager entityManager;

    private static Invoice newInvoice(InvoiceType type) {
        Invoice invoice = new Invoice();
        invoice.setType(type);
        invoice.setStatus(InvoiceStatus.OPEN);
        invoice.setDueDate(LocalDate.now());
        invoice.setInterestRate(BigDecimal.ZERO);
        invoice.setFineValue(BigDecimal.ZERO);
        return invoice;
    }

    @Test
    void persistInvoice_withOneItem_cascadesItem() {
        Supplier supplier = supplierRepository.saveAndFlush(new Supplier(null, "Acme", "1 Main St", null, null));
        Product product = productRepository.saveAndFlush(new Product("Widget", 10, 5.0));

        Invoice invoice = new Invoice();
        invoice.setType(InvoiceType.PURCHASE);
        invoice.setSupplier(supplier);
        invoice.setStatus(InvoiceStatus.OPEN);
        invoice.setDueDate(LocalDate.now());
        invoice.setInterestRate(BigDecimal.ZERO);
        invoice.setFineValue(BigDecimal.ZERO);
        InvoiceItem item = new InvoiceItem(null, invoice, product, 5, BigDecimal.TEN, 0);
        invoice.getItems().add(item);

        Invoice saved = invoiceRepository.saveAndFlush(invoice);

        assertThat(saved.getItems().get(0).getId()).isNotNull();
    }

    @Test
    void persistInvoiceItem_returnedQtyDefaultsToZero() {
        InvoiceItem item = new InvoiceItem();

        assertThat(item.getReturnedQty()).isEqualTo(0);
    }

    @Test
    void invoiceToString_withItems_doesNotRecurse() {
        Invoice invoice = new Invoice();
        invoice.setStatus(InvoiceStatus.OPEN);
        invoice.setDueDate(LocalDate.now());
        invoice.setInterestRate(BigDecimal.ZERO);
        invoice.setFineValue(BigDecimal.ZERO);
        InvoiceItem item = new InvoiceItem(null, invoice, null, 1, BigDecimal.ONE, 0);
        invoice.getItems().add(item);

        assertThatCode(invoice::toString).doesNotThrowAnyException();
    }

    @Test
    void persistSaleInvoice_withCustomerNoSupplier_succeedsAndRoundTripsType() {
        Customer customer = new Customer();
        customer.setName("Jane Doe");
        customer = customerRepository.saveAndFlush(customer);
        Invoice invoice = newInvoice(InvoiceType.SALE);
        invoice.setCustomer(customer);

        Invoice saved = invoiceRepository.saveAndFlush(invoice);

        assertThat(saved.getType()).isEqualTo(InvoiceType.SALE);
    }

    @Test
    void persistSaleInvoice_withNeitherSupplierNorCustomer_succeeds() {
        Invoice invoice = newInvoice(InvoiceType.SALE);

        Invoice saved = invoiceRepository.saveAndFlush(invoice);

        assertThat(saved.getId()).isNotNull();
    }

    @Test
    void persistSaleInvoice_withSupplier_rejected() {
        Supplier supplier = supplierRepository.saveAndFlush(new Supplier(null, "Acme", "1 Main St", null, null));
        Invoice invoice = newInvoice(InvoiceType.SALE);
        invoice.setSupplier(supplier);

        assertThatThrownBy(() -> invoiceRepository.saveAndFlush(invoice))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void persistPurchaseInvoice_withoutSupplier_rejected() {
        Invoice invoice = newInvoice(InvoiceType.PURCHASE);

        assertThatThrownBy(() -> invoiceRepository.saveAndFlush(invoice))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void persistInvoice_withPaidAt_roundTripsTimestamp() {
        LocalDateTime paidAt = LocalDateTime.of(2026, 3, 4, 10, 15, 30);
        Invoice invoice = newInvoice(InvoiceType.SALE);
        invoice.setPaidAt(paidAt);
        Long id = invoiceRepository.saveAndFlush(invoice).getId();
        // clear first: without it findById returns the managed instance and proves nothing about the column
        entityManager.clear();

        Invoice reloaded = invoiceRepository.findById(id).orElseThrow();

        assertThat(reloaded.getPaidAt()).isEqualTo(paidAt);
    }

    @Test
    void persistInvoice_withoutPaidAt_leavesTimestampNull() {
        Long id = invoiceRepository.saveAndFlush(newInvoice(InvoiceType.SALE)).getId();
        entityManager.clear();

        Invoice reloaded = invoiceRepository.findById(id).orElseThrow();

        assertThat(reloaded.getPaidAt()).isNull();
    }
}
