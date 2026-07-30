# ADR 026: Low Stock Applies Only to Ever-Stocked Products

**Scope**: [Cross-cutting]
**Status**: Accepted
**Date**: July 30, 2026

---

## Context

Creating a product is master-data maintenance and books no stock (ADR 018):
the product exists at quantity 0 until a purchase invoice closes and puts the
first units on the shelf (ADR 021). The low-stock alert, meanwhile, asked one
question — is the quantity below the threshold? — and a product created two
minutes ago answers yes.

So every new product landed in the low-stock list immediately, and the
production review named it for what it is: a false alarm about something that
was never stocked. The demo makes this visible daily, because products created
by hand between nightly resets appear in the alert having never been purchased.

The alert exists to say *reorder this*. That sentence only means something about
a product the business actually stocks.

## Decision

**Low stock scopes to products with at least one purchase booking.** The query
requires both the quantity threshold and a derived `ever_stocked` flag on
`product`, which the purchase booking path sets and no code path ever clears.

- `StockMovementService.recordMovement` calls `ProductService.markEverStocked`
  for reason `PURCHASE` only, inside the same transaction as the quantity
  adjustment. Purchases are the only way stock enters (ADR 021), so they are the
  only reason that can make a product ever-stocked.
- `markEverStocked` is idempotent — an already-marked product is left alone — and
  writes **no change-log row**. The audit trail records what an operator changed
  about the master data; this is state derived from the ledger, which the
  operator never edits.
- The flag is chosen over a query against the movement ledger specifically so
  that **the product module never reads another module's tables**. The product
  module owns `product`; the movement module owns `stock_movement`. The flag
  keeps that boundary intact and turns the alert back into a single-table query.
- The one-time backfill in `V21__add_product_ever_stocked.sql` does read across
  both tables, deriving the flag from existing `PURCHASE` movements. That read is
  legitimate where it lives: a migration operates on the schema as a whole, and
  it runs once rather than on every request.
- `ProductResponse` is unchanged. The flag is internal query state, not API
  surface, and the frontend card and KPI adapt through the endpoint's contents.

## Alternatives considered

**An `EXISTS` subquery against `stock_movement` from the product repository.**
Rejected. It needs no new column and no backfill, and it cannot drift from the
ledger — genuinely the simpler mechanism, which is worth recording as the cost of
this decision. But it makes routine cross-module table access part of the
product module's normal read path, which is the exact coupling the modulith
structure exists to prevent. A derived flag pays a small maintenance duty once,
at the single write path, to keep the boundary the architecture is built on.

**Excluding quantity-zero products from the alert.** Rejected, and it is worth
being explicit about why, because it is the cheapest possible change. A product
at zero is not the case the alert can afford to drop — it is the alert's most
urgent case. A stocked product sold down to nothing is precisely what "reorder
this" is for. The distinction that matters is not zero versus non-zero, it is
*never stocked* versus *stocked and now empty*, and only history can tell those
apart.

## Consequences

- A product purchased once and sold to zero **remains alerted**, at zero and at
  every quantity below the threshold.
- A product that was never purchased **never appears**, whatever its quantity.
- The flag **never reverts**. Having been stocked is historical fact, and no code
  path sets it false; a product that empties out stays in scope.
- `ProductResponse` and the low-stock endpoint's shape are unchanged, so no
  frontend change accompanies this one.
- The demo seeder builds all stock through the real services, so seeded products
  are flagged by the new path on every reseed. The baseline's one product below
  the threshold is purchased before it is sold, so the low-stock report stays
  populated.
- The threshold itself is untouched: still 5, still hardcoded at the controller.
  This decision changes *which* products the question is asked about, not the
  question.

[Back to Decisions Index](index.md)
