# ADR 021: Stock Enters Only Through Closed Purchase Invoices

**Status**: Accepted
**Date**: July 29, 2026

---

## Context

ADR 004 set the rule the inventory model rests on: every unit on hand traces to
a recorded business event. It then carved out one exception. NEW_PRODUCT
survived "solely as an opening balance for stock that predates the system, with
a caller-supplied cost basis" - a movement that increased stock with no supplier,
no invoice and no document, on a price the caller typed.

The exception was reasonable when it was written: a system being adopted has to
account for what is already on the shelves. But it never stayed in that role.
It was the mechanism the demo seeder used to stock a product, the one
integration-test fixtures reached for when a sale needed units to sell, and the
one reason on the standalone endpoint that could raise a quantity. In practice
it had become a general-purpose "add stock" button, and its cost basis was the
one price in the system that nobody had agreed to pay.

That matters more now than it did. ADR 018 made creation master data - it books
nothing. ADR 019 made the purchase price follow the last closed purchase line.
Both decisions push in the same direction: the invoice is the document, and the
document is what the numbers come from. NEW_PRODUCT was the remaining path that
answered "where did this stock come from, and what did it cost?" with "someone
said so".

## Decision

**Stock increases only by closing a purchase invoice.** NEW_PRODUCT is removed
from the domain: from the reason enum, from the validation matrix, from the API,
from the form, and its rows are deleted by V18. There is no opening-balance
movement, and a product's first units are bought exactly like its hundredth.

This is the *Belegprinzip* applied to inventory - no entry without a document.
Every unit that arrives now has a supplier, a price that a supplier charged, an
invoice line to point at, and a closing act with a user and a timestamp behind
it. "Where did this come from" has one answer, and it is a document.

**The standalone movements endpoint becomes a loss ledger.** The only reasons it
accepts are LOST and DESTROYED, both of which decrease stock and both of which
require a remark (ADR 020). It accepts no price at all: a cost snapshot belongs
to a purchase line, and purchases are not recorded there.

**Adopting the system means entering the opening stock as a purchase.** That is
the migration story, and it is a better one than a bare quantity: it produces the
supplier, the cost and the document that every later unit will have.

## Alternatives considered

**Keep NEW_PRODUCT for adoption only, gated by a flag or a role.** Rejected. A
path that exists is a path that gets used - this one already drifted from
"opening balance" to "add stock" without anybody deciding that it should. Gating
it narrows who can bypass the document rule without changing that the bypass
exists, and the gate itself becomes a thing to maintain and to test.

**Keep it but derive the cost from somewhere.** Rejected: there is nowhere
honest to derive it from. The product's own price is a starting value under
ADR 018, and using it would make the cost basis of real stock depend on a figure
typed on a master-data form.

**Migrate the existing rows to synthetic purchase invoices.** Rejected as
dishonest bookkeeping. A fabricated invoice against a fabricated supplier is a
worse record than no invoice: it looks like a document and answers to nobody.
The rows are deleted instead, which is defensible only because the deployed data
is the demo baseline the nightly reset (ADR 005) replaces wholesale - see the
consequence below.

**Leave the enum value in place and merely stop offering it.** Rejected: a value
the API still accepts is part of the contract regardless of what the UI shows,
and the report SQL would keep a `NEW_PRODUCT` branch that could never be true -
dead code that reads as a live rule.

## Consequences

- The movement stream is now fully documented. Every INCREASE is a PURCHASE
  against an invoice line, or a customer return against a sale line.
- The profit report's cost side simplifies: both cost branches drop from
  `reason IN ('PURCHASE','NEW_PRODUCT')` to `reason = 'PURCHASE'`. No figure
  moves, because the baseline's opening balance is now a purchase.
- The movements form loses its unit-cost field entirely; there is no reason left
  on that endpoint that carries a price.
- Stocking a genuinely new product is two acts instead of one: create it, then
  buy it. This is the intended cost, and it is the same shape as ADR 018's.
- V18 deletes existing NEW_PRODUCT rows. Deleting movement history contradicts
  ADR 004's append-only rule, and is acceptable here only because the deployed
  database is the demo baseline: the reason value no longer maps to a Java
  constant, so keeping the rows would turn history into a read-time failure. In a
  system with real history this decision would need a different migration -
  most likely retaining the rows behind a retired-value mapping.

[Back to Decisions Index](index.md)
