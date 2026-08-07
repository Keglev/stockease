package com.stocks.stockease.movement;

import static org.mockito.Mockito.mock;

import java.math.BigDecimal;

import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceItem;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.movement.internal.StockMovementRepository;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;

/*
 * Wiring shared by the two StockMovementService spec files: the collaborators the service books
 * through, the service under test, the acting user, and the command and invoice-line builders
 * both files arrange against.
 *
 * It is one class rather than two copies because the two specs must disagree only about
 * behaviour. A collaborator or a default command wired differently in one file would read as a
 * difference in the service, which is the one thing these tests exist to measure.
 *
 * Out of scope: stubbing. Nothing here arranges a return value - the stub helpers live with the
 * tests that consume them, so a reader learns why a test passes without leaving its file.
 */
class MovementTestFixtures {

    static final long PRODUCT_ID = 1L;
    static final long ITEM_ID = 7L;

    final StockMovementRepository stockMovementRepository = mock(StockMovementRepository.class);
    final ProductService productService = mock(ProductService.class);
    final InvoiceService invoiceService = mock(InvoiceService.class);

    final StockMovementService stockMovementService =
            new StockMovementService(stockMovementRepository, productService, invoiceService);

    final User user = new User("mover", "hash", "ROLE_ADMIN");

    static Product product() {
        Product product = new Product("Widget", 10, 5.0);
        product.setId(PRODUCT_ID);
        return product;
    }

    static InvoiceItem item(InvoiceType type, int quantity) {
        Invoice invoice = new Invoice();
        invoice.setType(type);
        // movements are only bookable against a closed invoice; the open case is its own test
        invoice.setStatus(InvoiceStatus.CLOSED);
        InvoiceItem item = new InvoiceItem();
        item.setId(ITEM_ID);
        item.setInvoice(invoice);
        item.setProduct(product());
        // The scalars the database fills on insert. Set by hand here because this fixture never
        // reaches a database, and the service reads them rather than the association (ADR 033).
        item.setProductId(PRODUCT_ID);
        item.setProductName("Widget");
        item.setQuantity(quantity);
        item.setUnitPrice(new BigDecimal("15.00"));
        return item;
    }

    /*
     * Builds a valid-by-default command. LOST and DESTROYED now require a remark, so one is attached
     * for them here rather than in each test; the remark rules have their own tests, which pass
     * the remark explicitly.
     */
    static RecordMovementCommand command(MovementReason reason, int quantity, Long itemId, BigDecimal cost) {
        MovementRemark remark = reason == MovementReason.LOST || reason == MovementReason.DESTROYED
                ? MovementRemark.INTERNAL
                : null;
        return new RecordMovementCommand(PRODUCT_ID, reason, quantity, itemId, cost, remark);
    }

    static RecordMovementCommand command(MovementReason reason, MovementRemark remark) {
        return new RecordMovementCommand(PRODUCT_ID, reason, 2, null, null, remark);
    }
}
