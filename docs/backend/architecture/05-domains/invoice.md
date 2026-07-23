# Module: invoice

Purchase and sales invoices with items - one entity, two types, one lifecycle.
Closing an invoice is the stock-booking act (ADR 004).

## Exposed API

`Invoice`, `InvoiceItem`, `InvoiceType`, `InvoiceStatus`,
`CreateInvoiceCommand`, `InvoiceService` (atomic create with items, close,
registerReturn, delete of OPEN invoices, markAsPaid, item lookups), and
`InvoiceClosedEvent`.

## Internals

`InvoiceRepository`, `InvoiceItemRepository`, and `OpenInvoiceDeletionVeto` -
the synchronous listeners (pinned to run before all others) that throw inside
a supplier or product deletion while open invoices pin the party.

## Events

Publishes `InvoiceClosedEvent` on close; the movement module books stock
synchronously in the same transaction. Consumes `SupplierDeletedEvent` and
`ProductChangedEvent` (deletion vetoes).

## Invariants

- Lifecycle OPEN -> CLOSED -> FULLY_RETURNED; close is strict OPEN-only;
  FULLY_RETURNED is terminal and set by the system when the last outstanding
  unit returns.
- Counterparty CHECK: purchases require a supplier and forbid a customer;
  sales forbid a supplier, customer optional.
- Returns are capped at the item quantity, enforced in the same transaction
  as the movement.
- Payment is a timestamp set exactly once; no unmark, no lifecycle gate;
  overdue is derived at read time (ADR 011).
- No edit methods exist: wrong OPEN invoices are deleted and recreated, wrong
  CLOSED invoices corrected through returns.

[Back to Domain Modules](index.md)
