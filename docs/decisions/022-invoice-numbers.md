# ADR 022: Invoice Numbers Are Operator-Assigned

**Status**: Accepted
**Date**: July 29, 2026

---

## Context

Until now an invoice was identified only by its database id. That works inside
the application and nowhere outside it. A supplier calls about "Rechnung
RE-2026-0117"; the operator has no way to find it except by scrolling a list
and matching dates and amounts. The one identifier the conversation is actually
about was the one the system did not record.

The two directions are not the same problem. A **purchase** invoice already has
a number - the supplier printed it on the document, and it is the supplier's
number, in the supplier's format. StockEase does not get to choose it; it has
to store whatever arrives. A **sale** invoice needs a number the business
issues itself, and in Germany that sequence is a bookkeeping obligation rather
than a convenience.

## Decision

**Every invoice carries an operator-assigned `invoiceNumber`.** On a purchase it
is the supplier's document number, transcribed. On a sale it is the operator's
own number from their own sequence. It is required at creation, free text, at
most 64 characters.

**Free text, not a generated sequence.** The system cannot generate a supplier's
number, and it should not pretend to own the sales sequence either - that
sequence usually starts before StockEase and continues in the accountant's
software. A field the operator fills is honest about who owns the number.
This is the same reasoning as ADR 018 applied to invoices rather than products:
an identifier the business already uses is master data, not something to invent.

**Unique among live invoices**, enforced by a partial unique index on
`invoice_number WHERE deleted_at IS NULL`, exactly as the product SKU rule in
V9. A soft-deleted invoice's number can be reissued, which is what makes
"delete the mistyped one and re-enter it under the same number" work. The
service checks first for a friendly message; the index is the concurrency
backstop.

Uniqueness is **global, not per type or per counterparty**. Two suppliers can in
principle issue the same number, and a stricter scope would be more faithful to
that - but the operator searching for a number wants one answer, and a
collision is rare enough to resolve by suffixing. Recorded here so the
narrowing is a decision to revisit rather than an oversight.

**The numeric id stays the technical key.** It remains the primary key, the
foreign key every other table points at, and the routing key in the frontend -
`/app/invoices/3`, not `/app/invoices/RE-2026-0117`. The number is a business
identifier and nothing more: it can be corrected, it can be reused after a
delete, and it must never become the thing a URL or a foreign key depends on.

## Alternatives considered

**Generate the number.** Rejected for purchases outright - the number belongs to
the supplier. For sales it would produce a second sequence competing with the
one the accountant already maintains, and reconciling two sequences is worse
than typing one number.

**Make it optional.** Rejected: an optional identifier is absent exactly when it
is needed, and the uniqueness rule becomes meaningless with a pile of nulls.

**Use the number as the primary key.** Rejected. It is operator-entered, so it
is typo-prone and correctable, and correcting a primary key means rewriting
every foreign key that references it. The id/number split is the standard answer
and keeps corrections cheap.

**Scope uniqueness per supplier.** Rejected for now; see above.

## Consequences

- An invoice can be found by the number the counterparty quotes.
- Creation gains one required field. Purchases copy it off the document; sales
  take the next number in the operator's sequence.
- Existing rows are backfilled by V19 with a synthetic `INV-<id>`, which is
  obviously not a real document number - deliberately, since none exists. The
  deployed data is the demo baseline that the nightly reset (ADR 005) replaces
  wholesale with properly numbered invoices.
- Lists and the detail header show the number; links, routes and every
  cross-reference still use the id. Widgets that currently show only `#id`
  (due-soon, overdue, dialogs) are unchanged for now and fold into the visual
  pass.

[Back to Decisions Index](index.md)
