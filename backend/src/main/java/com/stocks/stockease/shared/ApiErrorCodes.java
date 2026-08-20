package com.stocks.stockease.shared;

/**
 * Machine-readable failure identifiers carried in the {@code code} field of an error envelope.
 *
 * <p>These are API contract, not log strings. A client branches on them to choose which of its own
 * translated messages to show, so a value that changes silently changes what an operator reads.
 * They are declared here as constants for that reason: an inline literal in a handler is a contract
 * term nobody can find, and the frontend's matching constants have nothing to be checked against.
 *
 * <p>Codes are SCREAMING_SNAKE and name the situation, not the exception class that happened to
 * raise it - the class is an implementation detail the client must not depend on. One exception
 * class may therefore carry several codes, and two throw sites raising the same situation share one.
 *
 * <p>A code is optional by design. Most failures carry none, because the client has nothing useful
 * to do with them beyond showing the message; a code is added when a status alone leaves the client
 * unable to tell two situations apart that need different guidance. ADR 041 governs which situations
 * qualify and how they are delivered, and adds a second test to the first: the failure must reach a
 * screen in normal operation, and it must leave the operator a distinct action.
 *
 * <p>A coded situation whose sentence interpolates a runtime value carries that value in the
 * envelope's {@code params}, because a client rendering its own translated sentence has nowhere
 * else to read it from. Each constant below names its params keys.
 */
public final class ApiErrorCodes {

    /**
     * A return was attempted against a line whose product is soft-deleted. The operator can act on
     * this: restoring the product makes the same return an ordinary one (ADR 033).
     */
    public static final String PRODUCT_DELETED = "PRODUCT_DELETED";

    /** A stock change would drive the product's quantity below zero, so it was rejected. */
    public static final String INSUFFICIENT_STOCK = "INSUFFICIENT_STOCK";

    /**
     * A live product already holds the name a create or rename tried to claim. The operator chooses
     * a different name, or finds the product that already has this one.
     *
     * <p>Params: {@code name} - the name that is taken.
     */
    public static final String DUPLICATE_PRODUCT_NAME = "DUPLICATE_PRODUCT_NAME";

    /**
     * A live product already holds the SKU a create tried to claim. The operator chooses a different
     * SKU, or finds the product that already has this one.
     *
     * <p>Params: {@code sku} - the SKU that is taken.
     */
    public static final String DUPLICATE_PRODUCT_SKU = "DUPLICATE_PRODUCT_SKU";

    /**
     * A restore was refused because a live product has taken the deleted one's name. Distinct from
     * {@link #DUPLICATE_PRODUCT_NAME} because the operator's way out differs: the name cannot simply
     * be chosen again on a row that already has one, so the live product is renamed first, or the
     * restore is abandoned.
     *
     * <p>Params: {@code name} - the name the live product holds.
     */
    public static final String RESTORE_BLOCKED_BY_NAME = "RESTORE_BLOCKED_BY_NAME";

    /**
     * A restore was refused because a live product has taken the deleted one's SKU. The same
     * distinction as {@link #RESTORE_BLOCKED_BY_NAME}, on the other unique attribute.
     *
     * <p>Params: {@code sku} - the SKU the live product holds.
     */
    public static final String RESTORE_BLOCKED_BY_SKU = "RESTORE_BLOCKED_BY_SKU";

    /**
     * An invoice already carries the number a create tried to claim. Numbers are operator-assigned
     * (ADR 022), so the operator supplies another or opens the invoice that already has this one.
     *
     * <p>Params: {@code invoiceNumber} - the number that is taken.
     */
    public static final String DUPLICATE_INVOICE_NUMBER = "DUPLICATE_INVOICE_NUMBER";

    /**
     * A close was refused because the invoice is no longer open. The operator has nothing to fix on
     * the request: the invoice has already moved on, and its current state is what to look at.
     */
    public static final String INVOICE_NOT_OPEN_FOR_CLOSE = "INVOICE_NOT_OPEN_FOR_CLOSE";

    /**
     * A return was attempted against an invoice that is still open. Units are only returnable once
     * the invoice is closed, so the operator closes it first and then records the return.
     *
     * <p>Latent rather than live: the return endpoint is the only path into this guard, and the
     * movement service refuses an open invoice earlier on it with its own 400. This code reaches no
     * wire unless that ordering changes, and exists so the situation is named if it ever does.
     */
    public static final String RETURN_REQUIRES_CLOSED_INVOICE = "RETURN_REQUIRES_CLOSED_INVOICE";

    /**
     * A return asked for more units than the line still has outstanding. The operator lowers the
     * quantity to what remains, which the params name rather than leaving them to compute it.
     *
     * <p>Params: {@code quantity} - units the request tried to return; {@code remaining} - units
     * still returnable on the line; {@code itemId} - the invoice item the return names.
     */
    public static final String RETURN_EXCEEDS_RETURNABLE = "RETURN_EXCEEDS_RETURNABLE";

    /**
     * A payment was recorded against an invoice already marked paid. Nothing is owed and nothing
     * needs doing; the operator is looking at an invoice someone has already settled.
     */
    public static final String INVOICE_ALREADY_PAID = "INVOICE_ALREADY_PAID";

    /**
     * A delete was refused because the invoice is no longer open. A closed invoice is corrected by a
     * return rather than by deletion (ADR 011), which is the operator way forward here.
     */
    public static final String INVOICE_NOT_OPEN_FOR_DELETE = "INVOICE_NOT_OPEN_FOR_DELETE";

    /**
     * A supplier deletion was vetoed because open invoices still bill it. The operator settles or
     * deletes those invoices first; until then the supplier is load-bearing.
     *
     * <p>Params: {@code supplierName} - the supplier the veto names.
     */
    public static final String SUPPLIER_HAS_OPEN_INVOICES = "SUPPLIER_HAS_OPEN_INVOICES";

    /**
     * A customer deletion was vetoed because open invoices still bill them. Same remedy as the
     * supplier veto, on the other party to the invoice.
     *
     * <p>Params: {@code customerName} - the customer the veto names.
     */
    public static final String CUSTOMER_HAS_OPEN_INVOICES = "CUSTOMER_HAS_OPEN_INVOICES";

    /**
     * A product deletion was vetoed because the product is a line on an open invoice. The invoice
     * has to be settled or deleted before the product can go.
     *
     * <p>Params: {@code productName} - the product the veto names.
     */
    public static final String PRODUCT_ON_OPEN_INVOICE = "PRODUCT_ON_OPEN_INVOICE";

    /**
     * A product deletion was refused because the product still holds stock. Deleting it would
     * strand those units where no surface shows them, so they are written off or sold first and the
     * quantity is honestly zero before the delete (ADR 033).
     *
     * <p>Params: {@code productName} - the product the refusal names; {@code quantity} - units
     * still in stock, so a client need not re-read the product to say how many.
     */
    public static final String PRODUCT_HAS_STOCK = "PRODUCT_HAS_STOCK";


    /**
     * A request reached the return endpoint carrying a reason that is not one of the two return
     * directions. The operator - or more likely the client - sends losses to the stock-movement
     * endpoint and leaves purchases and sales to invoice closing.
     */
    public static final String MOVEMENT_ENDPOINT_RETURNS_ONLY = "MOVEMENT_ENDPOINT_RETURNS_ONLY";

    /**
     * A request reached the standalone stock-movement endpoint with a reason that belongs to
     * another flow. Only losses stand alone; stock arrives and leaves through invoice closing
     * (ADR 021) and returns have their own endpoint.
     */
    public static final String MOVEMENT_REASON_NOT_STANDALONE = "MOVEMENT_REASON_NOT_STANDALONE";

    /**
     * A movement was recorded with no user to attribute it to. Every movement is someone's action
     * and the ledger names who, so an unattributed one is refused rather than stored anonymously.
     *
     * <p>Latent rather than live: both controllers resolve the authenticated principal through
     * {@code currentUser()}, whose {@code orElseThrow} raises {@link IllegalStateException} and
     * answers 500 before the service is called, so no request arrives here with a null user. The
     * code exists so the situation is named if that ordering ever changes.
     */
    public static final String MOVEMENT_USER_REQUIRED = "MOVEMENT_USER_REQUIRED";

    /**
     * A movement named no product or no reason. Both fix what the movement does - which stock moves
     * and in which direction - so neither can be inferred and the request is refused.
     *
     * <p>Latent rather than live: {@code @NotNull} on {@code productId} and {@code reason} in both
     * request records yields the validation envelope first. The code exists so the situation is
     * named if that shadow ever moves.
     */
    public static final String MOVEMENT_PRODUCT_AND_REASON_REQUIRED = "MOVEMENT_PRODUCT_AND_REASON_REQUIRED";

    /**
     * A movement asked to move zero or fewer units. Direction is carried by the reason rather than
     * by the sign of the quantity, so a non-positive one has nothing to mean.
     *
     * <p>Latent rather than live: {@code @Positive} on {@code quantity} in both request records
     * yields the validation envelope first. The code exists so the situation is named if that
     * shadow ever moves.
     */
    public static final String MOVEMENT_QUANTITY_NOT_POSITIVE = "MOVEMENT_QUANTITY_NOT_POSITIVE";

    /**
     * A loss carried an invoice link or a price. Losses stand on their own and consume no cost
     * basis, so the operator drops those fields and records the loss by itself.
     *
     * <p>Latent rather than live: {@code RecordMovementRequest} declares no {@code invoiceItemId}
     * and no {@code unitCost} at all and its {@code toCommand} passes null for both, so a client
     * sending them has them ignored rather than refused. The code exists so the situation is named
     * if that shadow ever moves.
     */
    public static final String LOSS_MOVEMENT_CARRIES_NO_INVOICE_DATA = "LOSS_MOVEMENT_CARRIES_NO_INVOICE_DATA";

    /**
     * A loss was recorded without saying what happened to the units. The remark is what makes a
     * write-off auditable, so the operator picks one from the taxonomy (ADR 020).
     */
    public static final String LOSS_MOVEMENT_REQUIRES_REMARK = "LOSS_MOVEMENT_REQUIRES_REMARK";

    /**
     * A movement whose reason must be backed by an invoice line named none. The operator supplies
     * the line the units belong to.
     *
     * <p>Latent rather than live: {@code @NotNull invoiceItemId} on {@code RegisterReturnRequest}
     * yields the validation envelope first, and the standalone endpoint admits only losses, which
     * take the other branch. The code exists so the situation is named if that shadow ever moves.
     *
     * <p>Params: {@code reason} - the movement reason that requires the line.
     */
    public static final String MOVEMENT_REQUIRES_INVOICE_ITEM = "MOVEMENT_REQUIRES_INVOICE_ITEM";

    /**
     * A movement supplied a unit cost. Prices are snapshotted from the invoice line rather than
     * taken from the caller, so a supplied one could only disagree with the document.
     *
     * <p>Latent rather than live: neither request record declares a {@code unitCost} field, so a
     * client sending one has it ignored rather than refused. The code exists so the situation is
     * named if that shadow ever moves.
     */
    public static final String MOVEMENT_UNIT_COST_DERIVED = "MOVEMENT_UNIT_COST_DERIVED";

    /**
     * A movement that is not a loss carried a remark. A remark explains a write-off; on any other
     * reason it is a field the matrix has no meaning for.
     *
     * <p>Latent rather than live: {@code RegisterReturnRequest} declares no {@code remark} field, so
     * a client sending one has it ignored rather than refused. The code exists so the situation is
     * named if that shadow ever moves.
     *
     * <p>Params: {@code reason} - the movement reason the remark is forbidden for.
     */
    public static final String MOVEMENT_REMARK_FORBIDDEN = "MOVEMENT_REMARK_FORBIDDEN";

    /**
     * A movement referenced an invoice line of the wrong type - a return from a customer against a
     * purchase line, or the mirror mistake. The operator points it at a line on the other kind of
     * invoice.
     *
     * <p>Params: {@code reason} - the movement reason; {@code requiredType} - the invoice type its
     * line has to be on.
     */
    public static final String MOVEMENT_INVOICE_TYPE_MISMATCH = "MOVEMENT_INVOICE_TYPE_MISMATCH";

    /**
     * A movement was recorded against a line on an invoice that is still open. An open invoice is
     * still being edited and books no stock, so the operator closes it first (ADR 021).
     *
     * <p>Live, and the guard that shadows {@link #RETURN_REQUIRES_CLOSED_INVOICE}: the movement
     * service reaches this check before the invoice module's own open-invoice refusal, so a return
     * against an open invoice answers this 400 rather than that 409.
     */
    public static final String MOVEMENT_INVOICE_OPEN = "MOVEMENT_INVOICE_OPEN";

    /**
     * A movement named a product the invoice line does not carry. The product is stated explicitly
     * rather than derived precisely so this mistake is caught, so the operator corrects whichever
     * of the two is wrong.
     *
     * <p>Params: {@code invoiceItemId} - the line whose product disagrees.
     */
    public static final String MOVEMENT_ITEM_PRODUCT_MISMATCH = "MOVEMENT_ITEM_PRODUCT_MISMATCH";

    /**
     * A purchase or sale movement did not move the whole invoice line. Closing books a line exactly
     * once and in full, so a partial one would leave the document and the ledger disagreeing.
     *
     * <p>Latent rather than live: both controllers refuse {@code PURCHASE} and {@code SOLD} outright
     * - the standalone endpoint with {@link #MOVEMENT_REASON_NOT_STANDALONE}, the return endpoint
     * with {@link #MOVEMENT_ENDPOINT_RETURNS_ONLY} - so this check runs only for invoice closing,
     * which builds the command itself. The code exists so the situation is named if that shadow
     * ever moves.
     *
     * <p>Params: {@code quantity} - the units the line carries, which the movement has to match.
     */
    public static final String MOVEMENT_QUANTITY_MISMATCH = "MOVEMENT_QUANTITY_MISMATCH";

    /**
     * A purchase or sale movement already exists for the invoice line. Closing books each line once,
     * so a second one would double the stock the document accounts for.
     *
     * <p>Latent rather than live: shadowed by the same two controller reason gates as
     * {@link #MOVEMENT_QUANTITY_MISMATCH}. The code exists so the situation is named if that shadow
     * ever moves.
     *
     * <p>Params: {@code reason} - the movement reason already recorded; {@code invoiceItemId} - the
     * line it was recorded against.
     */
    public static final String MOVEMENT_ALREADY_RECORDED = "MOVEMENT_ALREADY_RECORDED";

    /**
     * A customer return found no sale movement to reverse. The return reverses exactly what the sale
     * booked, so without that movement there is no cost to give back (ADR 024).
     *
     * <p>Latent rather than live: closing a sale books a {@code SOLD} movement for every line, and a
     * return needs a closed invoice to reach this point, so a legitimate return always finds one.
     * The code exists so the situation is named if that ever stops holding.
     */
    public static final String RETURN_REQUIRES_SALE_MOVEMENT = "RETURN_REQUIRES_SALE_MOVEMENT";

    private ApiErrorCodes() {
    }
}
