# ADR 018: Product Creation is Master-Data Maintenance

**Status**: Accepted; partially superseded by ADR 021 (NEW_PRODUCT opening balance)
**Date**: July 29, 2026

---

## Context

ADR 004 states the rule the inventory model rests on: stock quantity must
always be explainable, because every unit on hand traces to a recorded
business event. It says so explicitly for creation - "creating a product
creates only the record" - and every path built since has honoured it. Closing
an invoice books one movement per item; the movements endpoint books an
opening balance under NEW_PRODUCT with a caller-supplied cost basis; returns
derive from the item they reverse. One write path, one lock, one history.

Product creation was the exception. It accepted a quantity and wrote it
straight onto the row, so a product could be born holding stock that no
movement had ever booked. The number was real to every consumer - it showed in
the catalogue, it satisfied a sale, it fed the stock-status report - but it had
no document behind it. The movement stream, which ADR 004 makes the quantity
history, silently disagreed with the quantity itself from the product's first
moment. Nothing detected the divergence, because the two were never compared:
the invariant every other path maintains was simply absent here.

The SKU had a smaller version of the same problem. The entity generated one
during persistence when the field was blank, which meant an operator who left
it empty received an identifier the system invented. A SKU is how a business
names its own article - a value that exists in catalogues, on shelf labels and
in a supplier's order confirmations, none of which this system can see. A
generated one is a placeholder wearing the costume of master data.

## Decision

**Creating a product books no stock.** Creation accepts name, SKU and purchase
price, and persists quantity 0. The request carries no quantity field at all,
so the omission is structural rather than a value that happens to be ignored.
A new product's stock arrives the way every other product's stock arrives:
through a purchase invoice, or through the movements endpoint under
NEW_PRODUCT for stock that predates the system. Both leave a document.

**The SKU is operator-assigned, never generated.** It is required at creation
and validated as non-blank; the auto-generation on persist is removed. A blank
SKU is now impossible through validation rather than quietly repaired, which
is ADR 002's principle applied to a field that had been exempt from it.

Together these make creation a pure master-data act: it declares that an
article exists and what it is called, and it asserts nothing about inventory.
The consequence worth stating plainly is that creation now affects no report.
Stock status, profit and loss all read from stock the movement stream can
account for, and a freshly created product contributes to none of them until a
document says it should.

## Alternatives considered

**Keep an optional quantity and book a NEW_PRODUCT movement for it.** Rejected
as the tempting one. It would preserve the invariant - the quantity would have
a document - but it hides a stock booking inside a master-data form, with no
cost basis the operator consciously supplied and no moment where they chose to
book anything. NEW_PRODUCT exists for a deliberate opening balance, and making
it a side effect of a create form devalues the one reason that means "this
stock predates the system". The endpoint is one call away for operators who
genuinely need it.

**Keep generating a SKU when the field is blank.** Rejected: it answers a
question only the business can answer. A generated identifier is
indistinguishable from a real one downstream, so the placeholder propagates
into labels and orders, and the moment the real article number appears there
is no safe way to tell which products carry an invented one.

**Enforce SKU uniqueness in the service only.** Rejected as insufficient
rather than wrong. The live-only partial index from V9 stays the authority
under concurrency; the service check exists to turn a constraint violation into
a message an operator can act on, mirroring what the name check already does.

## Consequences

- Quantity and the movement stream agree by construction, from the first row
  onward. The last path that could seed stock without a document is closed.
- The create form is smaller and means less: two identifying fields and a
  price, no inventory claim.
- Operators who previously created a product with opening stock now perform two
  acts instead of one. This is the intended cost - the second act is what
  produces the document.
- Existing rows are unaffected and no migration is needed. Live-only SKU
  uniqueness already exists from V9, and the deployed data is the demo
  baseline, which the nightly reset (ADR 005) replaces wholesale.

[Back to Decisions Index](index.md)
