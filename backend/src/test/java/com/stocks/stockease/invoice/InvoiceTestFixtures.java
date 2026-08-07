package com.stocks.stockease.invoice;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.springframework.context.ApplicationEventPublisher;

import com.stocks.stockease.customer.CustomerService;
import com.stocks.stockease.invoice.internal.InvoiceItemRepository;
import com.stocks.stockease.invoice.internal.InvoiceRepository;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.supplier.SupplierService;

/*
 * Wiring shared by the three InvoiceService spec files: one set of collaborators, one service
 * under test, and the object builders their arrangements are written against.
 *
 * It is one class rather than three copies because the three specs must disagree only about
 * behaviour. A collaborator wired differently in one file would read as a difference in the
 * service, which is the one thing these tests exist to measure.
 *
 * Out of scope: stubbing that only one group needs. Each spec arranges its own returns, so a
 * reader learns why a test passes without leaving the file it lives in. The single exception,
 * stubSaveReturnsArgument, is here because it stubs a collaborator this class owns.
 */
class InvoiceTestFixtures {

    final InvoiceItemRepository invoiceItemRepository = mock(InvoiceItemRepository.class);
    final InvoiceRepository invoiceRepository = mock(InvoiceRepository.class);
    final ProductService productService = mock(ProductService.class);
    final SupplierService supplierService = mock(SupplierService.class);
    final CustomerService customerService = mock(CustomerService.class);
    final ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);

    final InvoiceService invoiceService = new InvoiceService(invoiceItemRepository, invoiceRepository,
            productService, supplierService, customerService, eventPublisher);

    final User user = new User("closer", "hash", "ROLE_ADMIN");

    static Product product(long id) {
        Product product = new Product("Widget", 10, 5.0);
        product.setId(id);
        return product;
    }

    static Invoice invoiceWith(InvoiceStatus status, InvoiceType type) {
        Invoice invoice = new Invoice();
        invoice.setId(1L);
        invoice.setType(type);
        invoice.setStatus(status);
        return invoice;
    }

    /* Adds a line to the invoice and returns it, mirroring the bidirectional link JPA would load. */
    static InvoiceItem itemOn(Invoice invoice, long itemId, long productId, int quantity, int returnedQty) {
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

    static InvoiceItem itemWith(int quantity, int returnedQty) {
        return itemOn(invoiceWith(InvoiceStatus.CLOSED, InvoiceType.PURCHASE), 1L, 1L, quantity, returnedQty);
    }

    static CreateInvoiceCommand.ItemLine line(long productId, int quantity, BigDecimal unitPrice) {
        return new CreateInvoiceCommand.ItemLine(productId, quantity, unitPrice);
    }

    static CreateInvoiceCommand command(InvoiceType type, Long supplierId, Long customerId,
            CreateInvoiceCommand.ItemLine... lines) {
        return new CreateInvoiceCommand(type, "TST-SVC-1", supplierId, customerId, LocalDate.now(),
                BigDecimal.ONE, BigDecimal.ONE, List.of(lines));
    }

    /* Makes save return its argument so creation tests can assert on the built graph. */
    void stubSaveReturnsArgument() {
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(call -> call.getArgument(0));
    }
}
