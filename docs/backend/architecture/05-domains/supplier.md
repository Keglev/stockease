# Module: supplier

Purchase counterparties with full CRUD at service level and soft delete.

## Exposed API

`Supplier` entity, `SupplierService`, and `SupplierDeletedEvent`.

## Internals

`SupplierRepository`.

## Events

Publishes `SupplierDeletedEvent` BEFORE the delete executes, giving veto
listeners a chance to roll the whole transaction back. Consumed by the invoice
module's deletion veto.

## Invariants

- Deletion is vetoed while open invoices reference the supplier.
- Foreign keys restrict: a supplier referenced by any invoice cannot be
  hard-removed at the database level either.

[Back to Domain Modules](index.md)
