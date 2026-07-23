# Module: movement

Append-only stock movements behind a reason-driven validation matrix. The
movement stream IS the quantity history.

## Exposed API

`StockMovement`, `MovementType`, `MovementReason` (each reason carries its
type - inconsistent pairs are unrepresentable), `RecordMovementCommand`, and
`StockMovementService` with the single entry point `recordMovement`.

## Internals

`StockMovementRepository` and `InvoiceClosedListener` - the synchronous
listener that books one movement per invoice item inside the closing
transaction.

## Events

Consumes `InvoiceClosedEvent`. Publishes nothing.

## Invariants

- Matrix highlights: PURCHASE and SOLD require an invoice item of the
  matching invoice type, quantity equal to the item, at most one movement per
  item; returns require their originating item; NEW_PRODUCT, LOST and
  DESTROYED stand alone.
- Price snapshots are derived from the invoice item, never caller-supplied -
  except NEW_PRODUCT, whose caller-supplied unit cost is the opening-balance
  cost basis.
- A linked item's product must equal the movement's product, and its invoice
  must not be OPEN.
- Every movement adjusts stock through the product module's locked write
  path in the same transaction; insufficient stock on a sale close rolls
  back the entire close.

[Back to Domain Modules](index.md)
