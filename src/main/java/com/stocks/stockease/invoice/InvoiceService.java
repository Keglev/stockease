package com.stocks.stockease.invoice;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
import lombok.RequiredArgsConstructor;

/**
 * Invoice module's public API for the invoice lifecycle: creation, closing, returns and deletion.
 * Other modules depend on this service rather than reaching into the module's repositories.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InvoiceService {

    private final InvoiceItemRepository invoiceItemRepository;
    private final InvoiceRepository invoiceRepository;
    private final ProductService productService;
    private final SupplierService supplierService;
    private final CustomerService customerService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Finds an invoice item by its ID.
     *
     * @param id invoice item identifier
     * @return the invoice item, or empty if none exists with that ID
     */
    public Optional<InvoiceItem> findItemById(long id) {
        return invoiceItemRepository.findById(id);
    }

    /**
     * Creates an invoice together with all of its lines in one transaction.
     *
     * @param command the invoice and lines to create
     * @return the persisted invoice including its generated ID and items
     * @throws IllegalArgumentException if a required field is missing, the counterparty does not match the
     *         invoice type, or a line has a non-positive quantity or unit price
     * @throws EntityNotFoundException if the supplier, customer or any product does not exist
     */
    @Transactional
    public Invoice createInvoice(CreateInvoiceCommand command) {
        if (command.type() == null) {
            throw new IllegalArgumentException("Invoice type is required.");
        }
        if (command.dueDate() == null) {
            throw new IllegalArgumentException("Due date is required.");
        }
        if (command.items() == null || command.items().isEmpty()) {
            throw new IllegalArgumentException("An invoice requires at least one item.");
        }

        Invoice invoice = new Invoice();
        invoice.setType(command.type());
        applyCounterparty(command, invoice);
        invoice.setStatus(InvoiceStatus.OPEN);
        invoice.setDueDate(command.dueDate());
        invoice.setInterestRate(command.interestRate() == null ? BigDecimal.ZERO : command.interestRate());
        invoice.setFineValue(command.fineValue() == null ? BigDecimal.ZERO : command.fineValue());

        for (CreateInvoiceCommand.ItemLine line : command.items()) {
            invoice.getItems().add(buildItem(invoice, line));
        }
        return invoiceRepository.save(invoice);
    }

    /** Resolves and attaches the counterparty the invoice type calls for. */
    private void applyCounterparty(CreateInvoiceCommand command, Invoice invoice) {
        if (command.type() == InvoiceType.PURCHASE) {
            if (command.supplierId() == null || command.customerId() != null) {
                throw new IllegalArgumentException("Purchase invoices require a supplier and no customer.");
            }
            Supplier supplier = supplierService.findById(command.supplierId())
                    .orElseThrow(() -> new EntityNotFoundException(
                            "Supplier with ID " + command.supplierId() + " not found."));
            invoice.setSupplier(supplier);
            return;
        }
        if (command.supplierId() != null) {
            throw new IllegalArgumentException("Sale invoices must not reference a supplier.");
        }
        if (command.customerId() != null) {
            Customer customer = customerService.findById(command.customerId())
                    .orElseThrow(() -> new EntityNotFoundException(
                            "Customer with ID " + command.customerId() + " not found."));
            invoice.setCustomer(customer);
        }
    }

    /** Validates a line and builds its persistent item. */
    private InvoiceItem buildItem(Invoice invoice, CreateInvoiceCommand.ItemLine line) {
        if (line.quantity() <= 0) {
            throw new IllegalArgumentException("Item quantity must be positive.");
        }
        if (line.unitPrice() == null || line.unitPrice().signum() <= 0) {
            throw new IllegalArgumentException("Item unit price must be positive.");
        }
        Product product = productService.findById(line.productId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "Product with ID " + line.productId() + " not found."));

        InvoiceItem item = new InvoiceItem();
        item.setInvoice(invoice);
        item.setProduct(product);
        item.setQuantity(line.quantity());
        item.setUnitPrice(line.unitPrice());
        item.setReturnedQty(0);
        return item;
    }

    /**
     * Closes an open invoice and books its lines into stock.
     *
     * @param invoiceId invoice identifier
     * @param user user closing the invoice
     * @return the closed invoice
     * @throws EntityNotFoundException if no invoice exists with the given ID
     * @throws IllegalStateException if the invoice is not open, or if booking its stock movements fails
     */
    @Transactional
    public Invoice close(long invoiceId, User user) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new EntityNotFoundException("Invoice with ID " + invoiceId + " not found."));
        if (invoice.getStatus() != InvoiceStatus.OPEN) {
            throw new IllegalStateException("Only open invoices can be closed.");
        }
        invoice.setStatus(InvoiceStatus.CLOSED);
        invoice.setClosedBy(user);
        invoice.setClosedAt(LocalDateTime.now());
        invoiceRepository.save(invoice);

        List<InvoiceClosedEvent.Line> lines = invoice.getItems().stream()
                .map(item -> new InvoiceClosedEvent.Line(item.getId(), item.getProduct().getId(), item.getQuantity()))
                .toList();
        // synchronous listeners run inside this transaction - a failed stock booking rolls back the close
        eventPublisher.publishEvent(new InvoiceClosedEvent(invoice.getId(), invoice.getType(), user, lines));
        return invoice;
    }

    /**
     * Registers a return of {@code quantity} units against an invoice item.
     *
     * @param itemId invoice item identifier
     * @param quantity number of units being returned; must be positive
     * @return the updated invoice item
     * @throws EntityNotFoundException if no invoice item exists with the given ID
     * @throws IllegalArgumentException if {@code quantity} is not positive
     * @throws IllegalStateException if the invoice is still open, or if the return would exceed the item's
     *         remaining returnable quantity
     */
    @Transactional
    public InvoiceItem registerReturn(long itemId, int quantity) {
        InvoiceItem item = invoiceItemRepository.findById(itemId)
                .orElseThrow(() -> new EntityNotFoundException("Invoice item with ID " + itemId + " not found."));
        if (item.getInvoice().getStatus() == InvoiceStatus.OPEN) {
            throw new IllegalStateException("Returns require a closed invoice.");
        }
        if (quantity <= 0) {
            throw new IllegalArgumentException("Return quantity must be positive.");
        }
        // database CHECK on returned_qty is the backstop for this invariant
        if (item.getReturnedQty() + quantity > item.getQuantity()) {
            throw new IllegalStateException("Return of " + quantity + " exceeds remaining returnable quantity "
                    + (item.getQuantity() - item.getReturnedQty()) + " for invoice item " + itemId + ".");
        }
        item.setReturnedQty(item.getReturnedQty() + quantity);
        InvoiceItem saved = invoiceItemRepository.save(item);

        Invoice invoice = item.getInvoice();
        // allMatch over an empty collection is vacuously true - guard against any future creation
        // path that could yield an itemless invoice
        if (!invoice.getItems().isEmpty()
                && invoice.getItems().stream().allMatch(line -> line.getReturnedQty().equals(line.getQuantity()))) {
            invoice.setStatus(InvoiceStatus.FULLY_RETURNED);
            invoiceRepository.save(invoice);
        }
        return saved;
    }

    /**
     * Records that an invoice has been paid, stamping the moment of payment.
     * Payment is independent of the invoice lifecycle status: an invoice may be paid before or after
     * it is closed, so no status precondition applies.
     *
     * @param invoiceId invoice identifier
     * @return the paid invoice
     * @throws EntityNotFoundException if no invoice exists with the given ID
     * @throws IllegalStateException if the invoice is already marked as paid
     */
    @Transactional
    public Invoice markAsPaid(long invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new EntityNotFoundException("Invoice with ID " + invoiceId + " not found."));
        if (invoice.getPaidAt() != null) {
            throw new IllegalStateException("Invoice is already marked as paid.");
        }
        invoice.setPaidAt(LocalDateTime.now());
        return invoiceRepository.save(invoice);
    }

    /**
     * Deletes an open invoice; the entity's soft-delete mapping applies.
     *
     * @param invoiceId invoice identifier
     * @throws EntityNotFoundException if no invoice exists with the given ID
     * @throws IllegalStateException if the invoice is not open
     */
    @Transactional
    public void deleteById(long invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new EntityNotFoundException("Invoice with ID " + invoiceId + " not found."));
        if (invoice.getStatus() != InvoiceStatus.OPEN) {
            throw new IllegalStateException("Only open invoices can be deleted.");
        }
        invoiceRepository.delete(invoice);
    }
}
