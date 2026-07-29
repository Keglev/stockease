# ADR 019: The Purchase Price Follows the Last Closed Purchase

**Status**: Accepted
**Date**: July 29, 2026

---

## Context

A product carries one purchase price, and the profit report reads it as the cost
side of every margin it computes. Until now that number only moved when somebody
edited it by hand through the price endpoint.

Purchases were already telling the system what the product actually costs.
Closing a purchase invoice books a movement per line, and each line carries the
unit price the supplier charged - the real, current cost, arriving on a document,
at a known moment, attributed to a known user. The product row meanwhile kept
whatever price was typed at creation (ADR 018) until a human noticed the drift
and corrected it. The system held the right number and the wrong number at the
same time, and only the wrong one was reported on.

The open question was not whether purchases should inform the price, but which
costing model to adopt.

## Decision

**A product's purchase price is the unit price of the most recent closed
purchase invoice line for it** - the German "letzter Einkaufspreis". Closing a
PURCHASE invoice sets each line's product price to that line's unit price.

**The update runs through the existing audited path.** It calls the same
`ProductService.updatePrice` the price endpoint calls, so the change log records
the old and new value against the user who closed the invoice. There is no
second way for a price to move: one method writes the field, one listener writes
the history, and a price change from a purchase is indistinguishable in the log
from a manual correction except by who and when.

**Re-stating the same price is not a change.** If a line's unit price already
equals the product's price, nothing is written and no audit row appears. The
comparison is by value, not by scale: 2.50 and 2.5 are the same price.

**The rule is purely across invoices.** A single invoice cannot carry two lines
for the same product: V6 makes `(invoice_id, product_id)` unique, and a repeat
purchase raises that line's quantity instead of adding a second line. There is
therefore no within-invoice ordering to resolve - the most recently closed
purchase invoice decides the price.

**Creation price is the starting value.** The price entered at creation
(ADR 018) stands until the first purchase books, and is then replaced by
something a supplier actually charged.

SALE closes, returns, deletion and payment are untouched. So are movement
booking and its rollback semantics: repricing happens after the booking event,
inside the same transaction, so a failed booking still rolls the whole close
back, price included.

## Alternatives considered

**Moving-average cost.** The textbook answer, and rejected deliberately. It
values stock more faithfully when purchase prices swing, but it makes the price
field a derived aggregate: correct only if every movement that ever touched the
product is replayed in order, and impossible to explain without that replay.
Last-purchase-price is a fact with one document behind it - a user can point at
the invoice that set it. For a system whose audit story is "every number traces
to an event" (ADR 004), an average that traces to all of them equally traces to
none of them in particular. Adoption triggers are named: genuinely volatile
purchase prices, or a stock-valuation requirement that will not accept the
latest cost.

**FIFO or lot-based costing.** Rejected by ADR 010 already - stock is pooled, so
there are no lots to cost against.

**Keep the price manual, and report the drift.** Rejected: it turns a fact the
system already holds into a chore, and a report nobody reads is a slower version
of the bug.

**Store price history on the product.** Rejected as duplication. The change log
already records every price change with old value, new value, user and time.
Reusing it is what makes this decision small.

## Consequences

- The profit report's cost side tracks what the business currently pays, without
  anybody maintaining it.
- Margins on already-closed sales do not move: those movements carry their own
  price snapshots (ADR 004), and this changes only the product's current price.
- Closing a purchase can now write product change-log rows. They are attributed
  to the closing user, which is accurate - closing is the act that set the price.
- A mistyped unit price on a purchase line now propagates to the product's
  price. It is visible in the change log and corrected the same way any wrong
  price is: through the price endpoint, or by the next purchase.

[Back to Decisions Index](index.md)
