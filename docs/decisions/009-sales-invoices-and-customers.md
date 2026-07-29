# ADR 009: Sales Invoices and Customers

**Status**: Accepted
**Date**: July 23, 2026

---

## Context

The system began purchase-only: suppliers on every invoice, sales recorded as
bare movements. German commercial practice invoices every sale
(Ausgangsrechnung), and profit reporting needs sales to carry the same
document structure as purchases.

## Decision

**One invoice entity, two types.** Invoices carry a type - PURCHASE or
SALE - rather than splitting into separate entities: lifecycle, items,
closing and returns are identical machinery. The counterparty rule is
enforced by a database CHECK alongside service validation: a purchase
requires a supplier and forbids a customer; a sale forbids a supplier, and
its customer is optional.

**Customer is an entity, not text.** Sales counterparties are rows with soft
delete and a partial unique email index, referenced by a nullable foreign
key - enabling per-customer and per-city reporting later. An anonymous cash
sale (Barverkauf) is simply a sale invoice with no customer.

**Selling price is free.** The price on a sale item is set at invoicing time,
may deviate per invoice, and may be below cost - negative margin is valid and
visible, not prevented.

## Alternatives considered

**Separate sales-invoice entity.** Rejected: duplicated lifecycle and item
machinery for a one-field distinction the CHECK constraint expresses.

**Free-text counterparty on the invoice.** Rejected: unqueryable for
reporting and redundant next to a customer record; a nullable foreign key
costs nothing when absent.

**Mandatory customer on every sale.** Rejected: it would force fake customer
records for anonymous cash sales, polluting real reporting data.

## Consequences

- Every sale is a document with items, closable and returnable like a
  purchase; movement validation gains sale-side rules symmetrical to the
  purchase side.
- Customer deletion is vetoed while open invoices reference the customer,
  mirroring the supplier rule.

[Back to Decisions Index](index.md)
