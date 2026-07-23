# Module: product

Product master data and the single quantity write path. Names and SKUs are
unique case-insensitively among live rows via partial indexes, so soft-deleted
names stay reusable.

## Exposed API

`Product` entity, `ProductService` (create, rename, price change, soft delete,
restore, adjustQuantity), and `ProductChangedEvent`.

## Internals

`ProductRepository`, including restriction-bypassing native lookups used by
restore.

## Events

Publishes `ProductChangedEvent` on real name and price changes (no-op updates
are skipped), on deletion and on restore. Consumed by the audit module (change
log) and by the invoice module (deletion veto).

## Invariants

- `adjustQuantity` is the only quantity mutator: pessimistic lock, negative
  stock rejected, called only from the movement module's booking path.
- Soft delete stamps `deletedAt` and saves - never a repository delete, so
  same-transaction listeners keep a valid reference.
- Restore is blocked with clear messages if a live product took the name or
  SKU in the meantime; quantity is never change-logged (the movement stream is
  the quantity history).

[Back to Domain Modules](index.md)
