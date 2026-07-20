package com.stocks.stockease.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.model.Invoice;
import com.stocks.stockease.model.InvoiceItem;
import com.stocks.stockease.model.Product;
import com.stocks.stockease.model.Supplier;
import com.stocks.stockease.model.enums.InvoiceStatus;

/** Tests for {@link Invoice}/{@link InvoiceItem} JPA mapping, including the item cascade. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class InvoiceMappingTest {

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private ProductRepository productRepository;

    @Test
    void persistInvoice_withOneItem_cascadesItem() {
        Supplier supplier = supplierRepository.saveAndFlush(new Supplier(null, "Acme", "1 Main St", null));
        Product product = productRepository.saveAndFlush(new Product("Widget", 10, 5.0));

        Invoice invoice = new Invoice(null, supplier, InvoiceStatus.OPEN, LocalDate.now(),
                BigDecimal.ZERO, BigDecimal.ZERO, null, null, null, new ArrayList<>());
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
}
