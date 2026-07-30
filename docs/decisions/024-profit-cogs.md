# ADR 024: Gross Profit as Cost of Goods Sold, Captured at Sale

**Status**: Accepted
**Date**: July 30, 2026

---

## Context

The original profit expression charged **every purchased unit** as cost:

```
cost = PURCHASE quantity × unit_cost − RETURNED_TO_SUPPLIER quantity × invoice_item.unit_price
```

That makes buying stock look like a loss. A product bought a hundred units at a
time and sold ten reports a large negative gross profit, and the number only
turns positive once the last unit leaves the shelf. The production review
identified the cause: the expression measured **cash spent on inventory**, not
the cost of the goods that were actually sold. Those are two different
questions, and the reports page was answering the wrong one under the heading
"gross profit".

The information needed to answer the right one was not being recorded. A `SOLD`
movement captured its selling price but not what the units had cost, so at query
time there was nothing to charge against the revenue except the purchase rows.

## Decision

**Gross profit is revenue less the cost of the units sold**, and the cost of a
sold unit is captured **at the moment of the sale**:

- A `SOLD` movement now snapshots the product's purchase price into its own
  `unit_cost` when the sale invoice closes. This is a point-in-time fact, not a
  lookup: a later price change must not rewrite the profit of a sale that
  already happened.
- A `RETURN_FROM_CUSTOMER` movement **copies the `unit_cost` of the sale it
  reverses**, found through the invoice line. The reversal therefore cancels
  exactly what the sale booked, at both prices. Reading the product's current
  price here would leave a residue whenever the price moved between sale and
  return.
- `PURCHASE` and `RETURNED_TO_SUPPLIER` **leave the profit expression
  entirely**. They are the acquisition and un-acquisition of stock: cash-flow
  events. A payment-basis cash-flow report is the companion decision and will
  get its own ADR; that is where supplier returns belong.

The profit endpoints additionally accept an optional booking period (`from`,
`to`) over movement dates. The predicate lives in the `LEFT JOIN` condition
rather than in `WHERE`, so a product with no movements in the window still
appears with zeros instead of disappearing from the report.

Both profit reports — per product and per supplier — move together. They are one
definition of gross profit shown two ways on the same page, so a split between
them would be a defect rather than a nuance.

## Alternatives considered

**Compute COGS at query time from the product's current purchase price.**
Rejected: it makes historical profit a function of today's price list. Raising a
price would retroactively shrink the profit of every sale ever made, and the
reports would disagree with themselves between two page loads. This is the
failure the snapshot exists to prevent, and it is the same reasoning that put
the selling price on the movement in the first place.

**FIFO or weighted-average cost layers.** Rejected as disproportionate. Real cost
layering needs a ledger of purchase lots, consumption against those lots, and a
reconciliation story when stock is lost or destroyed — a bookkeeping subsystem
in its own right. ADR 010 already ruled out lot tracking, and ADR 019 already
defines a product's price as its last closed purchase price. Snapshotting that
same price at the sale is consistent with both, and for a single-price-per-
product domain the two approaches only diverge across a price change.

**Leaving historical rows with a NULL cost instead of backfilling.** Rejected:
`NULL` aggregates as zero cost, which would report every pre-existing sale as
pure profit — a worse error than an approximation.

## Consequences

- **V20 backfills historical `SOLD` and `RETURN_FROM_CUSTOMER` rows at the
  product's current purchase price.** This is an approximation: the true price
  at each past sale was never recorded and cannot be recovered. It is exact for
  every product whose price never changed. It is also a deliberate write to the
  append-only movement ledger, which V18 established as something done only in a
  migration and only on purpose; ADR 021 is the precedent.
- `MovementResponse.unitCost` is now populated for sales and customer returns,
  not only for purchases. Any consumer reading it as "this is a purchase" must
  read the reason instead.
- The `invoice_item` join leaves the profit query. It existed solely to price
  supplier returns, which no longer participate.
- Profit can no longer go negative merely because stock is on the shelf. It can
  still go negative honestly — selling below cost does exactly that.
- Seeded demo figures change sign. The seeder builds its stock through the real
  service calls, so it picks up the new capture automatically.
- Supplier returns now affect **no** report until the cash-flow report exists.
  That is a deliberate gap, not an oversight: they were previously folded into
  profit, where they did not belong.

[Back to Decisions Index](index.md)
