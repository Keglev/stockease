package com.stocks.stockease.invoice;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.internal.ProductRepository;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Tests that the paged invoice read slices the same rows, in the same order, as the unpaged one.
 * The two must not be able to disagree: the list page reads one and every other consumer the other.
 */
@SpringBootTest
@ActiveProfiles("test")
class InvoicePaginationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private InvoiceService invoiceService;

    @Autowired
    private ProductRepository productRepository;

    /** Numbers are unique among live invoices, and these tests commit, so each takes a fresh one. */
    private static final AtomicInteger NUMBERS = new AtomicInteger();

    /** Name and SKU are both unique constraints, and these tests commit, so both take the counter. */
    private Product newProduct() {
        int id = NUMBERS.incrementAndGet();
        Product product = new Product("Pagination Widget " + id, 500, 5.0);
        product.setSku("TST-PAGE-" + id);
        return productRepository.saveAndFlush(product);
    }

    private Invoice newSale(Product product) {
        return invoiceService.createInvoice(new CreateInvoiceCommand(InvoiceType.SALE,
                "TST-PAGE-" + NUMBERS.incrementAndGet(), null, null, LocalDate.now(), null, null,
                List.of(new CreateInvoiceCommand.ItemLine(product.getId(), 1, new BigDecimal("15.00")))));
    }

    @Test
    void findAllPaged_firstPage_slicesTheUnpagedListFromTheTop() {
        Product product = newProduct();
        for (int i = 0; i < 5; i++) {
            newSale(product);
        }
        List<Invoice> everything = invoiceService.findAll();

        Page<Invoice> first = invoiceService.findAll(PageRequest.of(0, 3));

        // same rows in the same order as the unpaged read, only cut short
        assertThat(first.getContent()).hasSize(3);
        assertThat(first.getContent().stream().map(Invoice::getId).toList())
                .isEqualTo(everything.stream().map(Invoice::getId).limit(3).toList());
        assertThat(first.getTotalElements()).isEqualTo(everything.size());
    }

    @Test
    void findAllPaged_secondPage_continuesWhereTheFirstStopped() {
        Product product = newProduct();
        for (int i = 0; i < 5; i++) {
            newSale(product);
        }
        List<Invoice> everything = invoiceService.findAll();

        Page<Invoice> second = invoiceService.findAll(PageRequest.of(1, 3));

        assertThat(second.getContent().stream().map(Invoice::getId).toList())
                .isEqualTo(everything.stream().map(Invoice::getId).skip(3).limit(3).toList());
    }

    @Test
    void findAllPaged_always_ordersNewestFirst() {
        Product product = newProduct();
        Invoice older = newSale(product);
        Invoice newer = newSale(product);

        List<Long> ids = invoiceService.findAll(PageRequest.of(0, 2)).getContent().stream()
                .map(Invoice::getId).toList();

        // the pageable carries no sort of its own, so this proves the repository method's ordering
        assertThat(ids.indexOf(newer.getId())).isLessThan(ids.indexOf(older.getId()));
    }

    @Test
    void findAllPaged_deletedInvoice_isExcludedAsInTheUnpagedList() {
        Product product = newProduct();
        Invoice removed = newSale(product);
        invoiceService.deleteById(removed.getId());

        Page<Invoice> page = invoiceService.findAll(PageRequest.of(0, 50));

        // the entity's @SQLRestriction applies to every query, and the count must honour it too
        assertThat(page.getContent()).noneMatch(invoice -> invoice.getId().equals(removed.getId()));
        assertThat(page.getTotalElements()).isEqualTo(invoiceService.findAll().size());
    }
}
