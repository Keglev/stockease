# ADR 011: Merchandise Scope and the Payment Fact

**Status**: Accepted
**Date**: July 23, 2026

---

## Context

Invoices have payment terms, due dates, and in commercial practice interest
and penalties. The question is how much of that belongs in a merchandise
system - and where bookkeeping (Buchhaltung) begins.

## Decision

**Payment is a fact, not a workflow.** An invoice records when it was paid:
a single timestamp, set exactly once. There is no unmark - correcting an
erroneous payment mark is accounting territory, handled as an administrative
intervention, not a domain feature. Payment is orthogonal to lifecycle:
prepayment before closing is legal, and no lifecycle transition checks
payment.

**Overdue is derived, never stored.** An invoice is overdue when it is
closed, unpaid and past its due date - a read-time predicate. Storing it
would create a value that goes stale every midnight.

**Financial arithmetic stays out.** Interest and penalty terms are stored as
contract facts and displayed; they are never computed into merchandise
profit. Profit in this system is gross merchandise profit (ADR 006);
financing costs, reminders and dunning belong to bookkeeping.

## Alternatives considered

**Payment status enum with transitions.** Rejected: a state machine for what
is one fact invites partial-payment scope creep; a timestamp is complete.

**Unmark or payment corrections.** Rejected: reversible payment marks turn
the field into a workflow with an audit problem; append-only correction of
money facts is precisely what accounting systems are for.

**Gating close or delete on payment.** Rejected: real invoices are paid
before, at, or long after closing; coupling the lifecycle to payment
contradicts practice.

## Consequences

- The invoice API stays small: mark paid, read derived overdue.
- Reports can bucket by due date and derive overdue without stored status.
- The system has a named boundary to point to when a financial feature is
  requested: displayed, never computed.

[Back to Decisions Index](index.md)
