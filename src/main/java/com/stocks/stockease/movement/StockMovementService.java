package com.stocks.stockease.movement;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.invoice.InvoiceItem;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.movement.internal.StockMovementRepository;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

/**
 * Movement module's public API and the single write path for product stock quantities.
 * Movements are append-only: a recorded movement is never updated or deleted.
 */
@Service
@RequiredArgsConstructor
public class StockMovementService {

    private final StockMovementRepository stockMovementRepository;
    private final ProductService productService;
    private final InvoiceService invoiceService;

    /**
     * Records a stock movement and applies its quantity change to the product atomically.
     *
     * @param command the movement to record
     * @param user the user triggering the movement
     * @return the persisted movement
     * @throws IllegalArgumentException if a required field is missing or a field is supplied that the reason forbids
     * @throws EntityNotFoundException if the referenced invoice item or product does not exist
     * @throws IllegalStateException if the movement contradicts its invoice item, duplicates an existing
     *         movement, or would drive the product's stock negative
     */
    @Transactional
    public StockMovement recordMovement(RecordMovementCommand command, User user) {
        if (user == null) {
            throw new IllegalArgumentException("User is required.");
        }
        if (command.productId() == null || command.reason() == null) {
            throw new IllegalArgumentException("Product and reason are required.");
        }
        if (command.quantity() <= 0) {
            throw new IllegalArgumentException("Quantity must be positive.");
        }

        MovementReason reason = command.reason();
        validateFields(command, reason);

        InvoiceItem item = requiresInvoiceItem(reason) ? loadAndValidateItem(command, reason) : null;
        if (reason == MovementReason.PURCHASE || reason == MovementReason.SOLD) {
            validateNotAlreadyRecorded(command, reason, item);
        }
        if (reason == MovementReason.RETURN_FROM_CUSTOMER || reason == MovementReason.RETURNED_TO_SUPPLIER) {
            // cap enforcement and the returnedQty increment join this transaction
            invoiceService.registerReturn(command.invoiceItemId(), command.quantity());
        }

        int delta = reason.getType() == MovementType.INCREASE ? command.quantity() : -command.quantity();
        Product product = productService.adjustQuantity(command.productId(), delta);

        return stockMovementRepository.save(buildMovement(command, reason, user, product, item));
    }

    /** Rejects fields the reason forbids and demands the ones it requires. */
    private void validateFields(RecordMovementCommand command, MovementReason reason) {
        switch (reason) {
            case NEW_PRODUCT -> {
                if (command.invoiceItemId() != null) {
                    throw new IllegalArgumentException("NEW_PRODUCT movements must not reference an invoice item.");
                }
                if (command.unitCost() == null || command.unitCost().signum() <= 0) {
                    throw new IllegalArgumentException("NEW_PRODUCT movements require a positive unit cost.");
                }
            }
            case LOST, DESTROYED -> {
                if (command.invoiceItemId() != null || command.unitCost() != null) {
                    throw new IllegalArgumentException(
                            "LOST and DESTROYED movements carry no invoice item or prices.");
                }
            }
            default -> {
                if (command.invoiceItemId() == null) {
                    throw new IllegalArgumentException(reason + " movements require an invoice item.");
                }
                if (command.unitCost() != null) {
                    throw new IllegalArgumentException(
                            "Unit cost is derived from the invoice item and must not be supplied.");
                }
            }
        }
    }

    /** Loads the linked invoice item and checks it matches the movement's invoice type and product. */
    private InvoiceItem loadAndValidateItem(RecordMovementCommand command, MovementReason reason) {
        InvoiceItem item = invoiceService.findItemById(command.invoiceItemId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "Invoice item with ID " + command.invoiceItemId() + " not found."));
        InvoiceType requiredType = reason == MovementReason.PURCHASE || reason == MovementReason.RETURNED_TO_SUPPLIER
                ? InvoiceType.PURCHASE
                : InvoiceType.SALE;
        if (item.getInvoice().getType() != requiredType) {
            throw new IllegalStateException(
                    reason + " movements must reference a " + requiredType + " invoice item.");
        }
        if (!item.getProduct().getId().equals(command.productId())) {
            throw new IllegalStateException(
                    "Invoice item " + command.invoiceItemId() + " belongs to a different product.");
        }
        return item;
    }

    /** Holds a purchase or sale to its invoice line's exact quantity, once per line. */
    private void validateNotAlreadyRecorded(RecordMovementCommand command, MovementReason reason, InvoiceItem item) {
        if (command.quantity() != item.getQuantity()) {
            throw new IllegalStateException(
                    "Movement quantity must equal the invoice item quantity (" + item.getQuantity() + ").");
        }
        if (stockMovementRepository.existsByInvoiceItemIdAndReason(command.invoiceItemId(), reason)) {
            throw new IllegalStateException(
                    "A " + reason + " movement already exists for invoice item " + command.invoiceItemId() + ".");
        }
    }

    /** Assembles the movement row, snapshotting prices from the invoice item rather than the caller. */
    private StockMovement buildMovement(RecordMovementCommand command, MovementReason reason, User user,
            Product product, InvoiceItem item) {
        StockMovement movement = new StockMovement();
        movement.setProduct(product);
        movement.setUser(user);
        movement.setType(reason.getType());
        movement.setReason(reason);
        movement.setQuantity(command.quantity());
        movement.setInvoiceItem(item);
        switch (reason) {
            case PURCHASE -> movement.setUnitCost(item.getUnitPrice());
            case SOLD, RETURN_FROM_CUSTOMER -> movement.setSoldPrice(item.getUnitPrice());
            case NEW_PRODUCT -> movement.setUnitCost(command.unitCost());
            default -> {
                // LOST, DESTROYED and RETURNED_TO_SUPPLIER carry no price snapshot
            }
        }
        return movement;
    }

    /** Reports whether the reason must be backed by an invoice line. */
    private static boolean requiresInvoiceItem(MovementReason reason) {
        return reason == MovementReason.PURCHASE || reason == MovementReason.SOLD
                || reason == MovementReason.RETURN_FROM_CUSTOMER || reason == MovementReason.RETURNED_TO_SUPPLIER;
    }
}
