package com.stocks.stockease.movement;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.invoice.InvoiceItem;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.invoice.InvoiceStatus;
import com.stocks.stockease.invoice.InvoiceType;
import com.stocks.stockease.movement.internal.StockMovementRepository;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.User;
import com.stocks.stockease.shared.ApiErrorCodes;
import com.stocks.stockease.shared.InsufficientStockException;
import com.stocks.stockease.shared.InvalidMovementException;
import com.stocks.stockease.shared.ProductDeletedException;

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
     * Returns every stock movement a user triggered, newest first.
     *
     * @param userId user identifier
     * @return that user's movements ordered by creation time descending
     */
    @Transactional(readOnly = true)
    public List<StockMovement> findByUser(long userId) {
        return stockMovementRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    /**
     * Records a stock movement and applies its quantity change to the product atomically.
     *
     * @param command the movement to record
     * @param user the user triggering the movement
     * @return the persisted movement
     * @throws InvalidMovementException if a required field is missing, a field is supplied that the reason
     *         forbids, or the movement contradicts or duplicates its invoice item
     * @throws EntityNotFoundException if the referenced invoice item or product does not exist
     * @throws InsufficientStockException if the movement would drive the product's stock negative
     */
    @Transactional
    public StockMovement recordMovement(RecordMovementCommand command, User user) {
        if (user == null) {
            throw new InvalidMovementException("User is required.",
                    ApiErrorCodes.MOVEMENT_USER_REQUIRED, null);
        }
        if (command.productId() == null || command.reason() == null) {
            throw new InvalidMovementException("Product and reason are required.",
                    ApiErrorCodes.MOVEMENT_PRODUCT_AND_REASON_REQUIRED, null);
        }
        if (command.quantity() <= 0) {
            throw new InvalidMovementException("Quantity must be positive.",
                    ApiErrorCodes.MOVEMENT_QUANTITY_NOT_POSITIVE, null);
        }

        MovementReason reason = command.reason();
        validateFields(command, reason);

        InvoiceItem item = requiresInvoiceItem(reason) ? loadAndValidateItem(command, reason) : null;
        if (reason == MovementReason.PURCHASE || reason == MovementReason.SOLD) {
            validateNotAlreadyRecorded(command, reason, item);
        }
        if (reason == MovementReason.RETURN_FROM_CUSTOMER || reason == MovementReason.RETURNED_TO_SUPPLIER) {
            rejectReturnAgainstDeletedProduct(item);
            // cap enforcement and the returnedQty increment join this transaction
            invoiceService.registerReturn(command.invoiceItemId(), command.quantity());
        }

        int delta = reason.getType() == MovementType.INCREASE ? command.quantity() : -command.quantity();
        Product product = productService.adjustQuantity(command.productId(), delta);
        if (reason == MovementReason.PURCHASE) {
            // a purchase is the only way stock enters (ADR 021), so it is the only reason that can make a
            // product ever-stocked; the flag rides the same transaction as the quantity it derives from
            productService.markEverStocked(product);
        }

        return stockMovementRepository.save(buildMovement(command, reason, user, product, item));
    }

    /**
     * Refuses a return whose product has been soft-deleted, and says how to proceed.
     *
     * <p>Returns move stock, and stock belongs to a live product: accepting one here would credit
     * units to a row no catalogue, stock report or picker shows, leaving inventory that exists in the
     * ledger and nowhere else. Restoring the product first makes the return an ordinary one, which is
     * the manual path this message points at (ADR 033).
     *
     * <p>Checked by querying live products with the line's foreign-key scalar rather than through
     * {@code item.getProduct()}: the association is exactly what a soft-deleted row hides, so asking
     * it would raise Hibernate's own error instead of this explanation.
     */
    private void rejectReturnAgainstDeletedProduct(InvoiceItem item) {
        if (productService.findById(item.getProductId()).isEmpty()) {
            throw new ProductDeletedException("Cannot register a return for '" + item.getProductName()
                    + "': the product is deleted. Restore it first, then record the return.");
        }
    }

    /** Rejects fields the reason forbids and demands the ones it requires. */
    private void validateFields(RecordMovementCommand command, MovementReason reason) {
        switch (reason) {
            case LOST, DESTROYED -> {
                if (command.invoiceItemId() != null || command.unitCost() != null) {
                    throw new InvalidMovementException(
                            "LOST and DESTROYED movements carry no invoice item or prices.",
                            ApiErrorCodes.LOSS_MOVEMENT_CARRIES_NO_INVOICE_DATA, null);
                }
                if (command.remark() == null) {
                    throw new InvalidMovementException("LOST and DESTROYED movements require a remark.",
                            ApiErrorCodes.LOSS_MOVEMENT_REQUIRES_REMARK, null);
                }
            }
            default -> {
                // the one rendering of the reason, so the sentence and the params it carries cannot drift
                String reasonName = reason.name();
                if (command.invoiceItemId() == null) {
                    throw new InvalidMovementException(reasonName + " movements require an invoice item.",
                            ApiErrorCodes.MOVEMENT_REQUIRES_INVOICE_ITEM, Map.of("reason", reasonName));
                }
                if (command.unitCost() != null) {
                    throw new InvalidMovementException(
                            "Unit cost is derived from the invoice item and must not be supplied.",
                            ApiErrorCodes.MOVEMENT_UNIT_COST_DERIVED, null);
                }
                if (command.remark() != null) {
                    throw new InvalidMovementException(
                            "A remark explains a loss and must not be supplied for " + reasonName + " movements.",
                            ApiErrorCodes.MOVEMENT_REMARK_FORBIDDEN, Map.of("reason", reasonName));
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
            // both values are shared by the sentence and the params, so each is rendered once
            String reasonName = reason.name();
            String requiredTypeName = requiredType.name();
            throw new InvalidMovementException(
                    reasonName + " movements must reference a " + requiredTypeName + " invoice item.",
                    ApiErrorCodes.MOVEMENT_INVOICE_TYPE_MISMATCH,
                    Map.of("reason", reasonName, "requiredType", requiredTypeName));
        }
        if (item.getInvoice().getStatus() == InvoiceStatus.OPEN) {
            throw new InvalidMovementException("Movements cannot be recorded against an open invoice.",
                    ApiErrorCodes.MOVEMENT_INVOICE_OPEN, null);
        }
        // the line's foreign-key scalar rather than the association: a soft-deleted product must
        // reach the return guard's explanation rather than Hibernate's proxy error (ADR 033)
        if (!item.getProductId().equals(command.productId())) {
            String invoiceItemId = String.valueOf(command.invoiceItemId());
            throw new InvalidMovementException(
                    "Invoice item " + invoiceItemId + " belongs to a different product.",
                    ApiErrorCodes.MOVEMENT_ITEM_PRODUCT_MISMATCH, Map.of("invoiceItemId", invoiceItemId));
        }
        return item;
    }

    /** Holds a purchase or sale to its invoice line's exact quantity, once per line. */
    private void validateNotAlreadyRecorded(RecordMovementCommand command, MovementReason reason, InvoiceItem item) {
        if (command.quantity() != item.getQuantity()) {
            String quantity = String.valueOf(item.getQuantity());
            throw new InvalidMovementException(
                    "Movement quantity must equal the invoice item quantity (" + quantity + ").",
                    ApiErrorCodes.MOVEMENT_QUANTITY_MISMATCH, Map.of("quantity", quantity));
        }
        if (stockMovementRepository.existsByInvoiceItemIdAndReason(command.invoiceItemId(), reason)) {
            String reasonName = reason.name();
            String invoiceItemId = String.valueOf(command.invoiceItemId());
            throw new InvalidMovementException(
                    "A " + reasonName + " movement already exists for invoice item " + invoiceItemId + ".",
                    ApiErrorCodes.MOVEMENT_ALREADY_RECORDED,
                    Map.of("reason", reasonName, "invoiceItemId", invoiceItemId));
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
        // null for every reason but LOST and DESTROYED, which validation has already required it for
        movement.setRemark(command.remark());
        switch (reason) {
            case PURCHASE -> movement.setUnitCost(item.getUnitPrice());
            case SOLD -> {
                movement.setSoldPrice(item.getUnitPrice());
                // The COGS snapshot: what these units cost at the moment they left. The product's
                // purchase price may change afterwards without rewriting this sale's profit (ADR 024).
                movement.setUnitCost(product.getPurchasePrice());
            }
            case RETURN_FROM_CUSTOMER -> {
                movement.setSoldPrice(item.getUnitPrice());
                movement.setUnitCost(saleUnitCost(item));
            }
            default -> {
                // LOST, DESTROYED and RETURNED_TO_SUPPLIER carry no price snapshot
            }
        }
        return movement;
    }

    /**
     * Reads the cost the matching sale captured, so a return reverses exactly what the sale booked.
     */
    private BigDecimal saleUnitCost(InvoiceItem item) {
        // Deliberately not the product's current price: a price change between sale and return would
        // make the reversal cancel a different amount than the sale added. After the V20 backfill
        // every SOLD movement carries a cost, so a legitimate return always finds one.
        return stockMovementRepository
                .findFirstByInvoiceItemIdAndReason(item.getId(), MovementReason.SOLD)
                .map(StockMovement::getUnitCost)
                .orElseThrow(() -> new InvalidMovementException(
                        "A customer return requires the stock movement of the sale it reverses.",
                        ApiErrorCodes.RETURN_REQUIRES_SALE_MOVEMENT, null));
    }

    /** Reports whether the reason must be backed by an invoice line. */
    private static boolean requiresInvoiceItem(MovementReason reason) {
        return reason == MovementReason.PURCHASE || reason == MovementReason.SOLD
                || reason == MovementReason.RETURN_FROM_CUSTOMER || reason == MovementReason.RETURNED_TO_SUPPLIER;
    }
}
