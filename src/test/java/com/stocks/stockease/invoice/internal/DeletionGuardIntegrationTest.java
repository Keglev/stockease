package com.stocks.stockease.invoice.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceItem;
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.product.internal.ProductRepository;
import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;
import com.stocks.stockease.supplier.internal.SupplierRepository;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Tests the open-invoice deletion vetoes end to end. Every method runs outside a test transaction so
 * the assertions observe committed state and a vetoed deletion is a real rollback, not a test rollback.
 */
@SpringBootTest
@ActiveProfiles("test")
class DeletionGuardIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private SupplierService supplierService;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private ProductService productService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceItemRepository invoiceItemRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User user;

    @BeforeEach
    void setUp() {
        user = userRepository.findByUsername("guard-tester")
                .orElseGet(() -> userRepository.saveAndFlush(new User("guard-tester", "hash", "ROLE_ADMIN")));
    }

    private Supplier newSupplier() {
        return supplierRepository.saveAndFlush(new Supplier(null, "Guard Supplier", "1 Main St", null, null));
    }

    /** Persists a purchase invoice in the given status, optionally carrying one line for {@code product}. */
    private Invoice newInvoice(Supplier supplier, InvoiceStatus status, Product product) {
        Invoice invoice = new Invoice();
        invoice.setType(InvoiceType.PURCHASE);
        invoice.setSupplier(supplier);
        invoice.setStatus(status);
        invoice.setDueDate(LocalDate.now());
        invoice.setInterestRate(BigDecimal.ZERO);
        invoice.setFineValue(BigDecimal.ZERO);
        invoice = invoiceRepository.saveAndFlush(invoice);
        if (product != null) {
            InvoiceItem item = new InvoiceItem();
            item.setInvoice(invoice);
            item.setProduct(product);
            item.setQuantity(2);
            item.setUnitPrice(new BigDecimal("15.00"));
            item.setReturnedQty(0);
            invoiceItemRepository.saveAndFlush(item);
        }
        return invoice;
    }

    private int deletedLogRows(Long productId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM product_change_log WHERE product_id = ? AND field = 'DELETED'",
                Integer.class, productId);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void deleteSupplier_withOpenInvoice_vetoedAndRolledBack() {
        Supplier supplier = newSupplier();
        newInvoice(supplier, InvoiceStatus.OPEN, null);

        assertThatThrownBy(() -> supplierService.deleteById(supplier.getId()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("open invoices exist");

        Supplier reloaded = supplierRepository.findById(supplier.getId()).orElseThrow();
        assertThat(reloaded.getDeletedAt()).isNull();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void deleteSupplier_withOnlyClosedInvoices_succeeds() {
        Supplier supplier = newSupplier();
        newInvoice(supplier, InvoiceStatus.CLOSED, null);

        supplierService.deleteById(supplier.getId());

        assertThat(supplierRepository.findById(supplier.getId())).isEmpty();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void deleteProduct_onOpenInvoice_vetoedAndRolledBack() {
        Product product = productRepository.saveAndFlush(new Product("Guard Open Invoice Widget", 10, 5.0));
        newInvoice(newSupplier(), InvoiceStatus.OPEN, product);

        assertThatThrownBy(() -> productService.deleteById(product.getId(), user))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("it appears on an open invoice");

        assertThat(productRepository.findById(product.getId())).isPresent();
        // the veto must roll back the audit row the listener had already written
        assertThat(deletedLogRows(product.getId())).isEqualTo(0);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void deleteProduct_onlyOnClosedInvoice_succeeds() {
        Product product = productRepository.saveAndFlush(new Product("Guard Closed Invoice Widget", 10, 5.0));
        newInvoice(newSupplier(), InvoiceStatus.CLOSED, product);

        productService.deleteById(product.getId(), user);

        assertThat(productRepository.findById(product.getId())).isEmpty();
        assertThat(deletedLogRows(product.getId())).isEqualTo(1);
    }
}
