# ADR 025: Cash Flow Report on a Payment Basis

**Status**: Accepted
**Date**: July 30, 2026

---

## Context

ADR 024 removed purchases and supplier returns from gross profit. They were
never profit — buying stock is not a loss and sending it back is not a gain —
but they are real money leaving and returning, and once they left the profit
report they were reported nowhere at all. That was a deliberate gap with a named
successor: the cash-flow view.

The production review defined what it should answer: **money in from sales,
money out to purchases, overall and per product, over a period the operator
chooses.** That is a different question from profit, and it deserves a different
report rather than a second column on the existing one.

The one genuinely open question was *when* money counts.

## Decision

**Payment basis.** An invoice enters the cash-flow report on the date it was
**paid**, at its value net of returned quantities.

- Inflow is paid `SALE` invoices, outflow is paid `PURCHASE` invoices, and net
  is inflow less outflow. Both are aggregated per product and summed for the
  overall totals.
- A booked but unpaid invoice is **invisible** here, whatever the period. On a
  payment basis it has not happened yet.
- Each line contributes `(quantity − returned_qty) × unit_price`. A return
  therefore adjusts the flow of the invoice it belongs to, **realized at that
  invoice's payment date** rather than on the date the goods actually went back.
  This is an approximation, and it is the one deliberate inaccuracy in the
  report: refund timing is not modeled as an event of its own, so there is no
  date to attribute it to.
- Products that moved no money in the window are **absent**, not listed with
  zeros. This differs from the profit report on purpose: a cash-flow report
  lists money that moved, and padding it invites reading "nothing happened" as
  "nothing exists". Soft-deleted products stay listed and flagged — the money
  they moved still moved.
- The overall totals are summed from the product rows rather than fetched by a
  second aggregate query. Every invoice line names a product, so the rows
  already account for every cent the query matched.

## Alternatives considered

**Booking basis — count an invoice when it closes.** Rejected. It counts money
that has not moved: an invoice closed on generous payment terms would appear as
cash the business does not have. That is precisely the conflation ADR 024 just
removed from gross profit, and repeating it one report over would undo the
distinction both reports exist to draw. It is the simpler query — no payment
date to filter on, and the existing `status <> 'OPEN'` predicate would have done
— which is worth recording as the cost of this decision rather than pretending
there was none.

**Model refunds as dated cash events.** Rejected as disproportionate. Attributing
a refund to its own date needs a payments ledger: refund rows with their own
amounts, dates and links back to the invoice line, plus a reconciliation story
when a refund is partial or reversed. The domain needs none of that for anything
else, and the error the approximation introduces is bounded — a refund is
misdated only by the gap between the return and the invoice's payment.

**A separate cash-flow module.** Rejected: this is an aggregation over invoices,
which is what the reporting module already is. It follows the customer-summary
precedent and lives under `/api/reports` on the existing controller.

## Consequences

- Unpaid invoices are invisible to cash flow regardless of the period selected.
  An operator looking for money still owed wants the due-soon and overdue
  reports, which are the deliberate complement to this one.
- The demo seed gains **four paid invoices** — two purchases and two sales — so
  the report demonstrates against live data instead of rendering empty. They are
  new invoices rather than payments applied to existing ones: settling an
  existing invoice would remove it from the due-soon and overdue listings, whose
  populated state the demo baseline pins.
- Returns are visible in cash flow only through the reduced value of their
  invoice. There is no per-return line, and there cannot be one without the
  refund ledger rejected above.
- The frontend tab arrives in a follow-up slice; this change is backend, spec
  and generated types only.

[Back to Decisions Index](index.md)
