# ADR 004: Inventory Domain Model

**Status**: Accepted
**Date**: July 23, 2026

---

## Context

Stock quantity must always be explainable: every unit on hand traces to
recorded business events. The design question is how stock changes relate to
invoices - when stock is booked, who supplies prices, and whether bookings can
be partial or corrected.

## Decision

**Movements are append-only facts.** A stock movement is never edited or
deleted. Each movement carries a reason, and the movement type (IN or OUT) is
always derived from that reason - inconsistent pairs are unrepresentable.

**Invoice-linked reasons derive everything from the invoice item.** PURCHASE
and SOLD movements require an invoice item of the matching invoice type; the
movement quantity must equal the item quantity, at most one such movement
exists per item, and the price snapshot (unit cost or sold price) is copied
from the item's unit price - never caller-supplied. Both return reasons
likewise require their originating item and derive their snapshot from it, so
a return can never be priced differently from its sale or purchase.

**Closing the invoice is the booking act.** An OPEN invoice is recorded but
not booked and may be deleted. Closing stamps the actor and time and books one
movement per item; creating a product creates only the record - first stock
arrives through a purchase invoice like any restock. NEW_PRODUCT survives
solely as an opening balance for stock that predates the system, with a
caller-supplied cost basis.

**No partial bookings.** The invoice item is the purchase or sale. Smaller
sales are new invoices; partial flows are returns, capped so that returned
quantity never exceeds the item quantity.

**One quantity write path.** All movements adjust stock through a single
service method holding a pessimistic lock; negative stock is rejected with no
override.

## Alternatives considered

**Caller-supplied prices on movements.** Rejected: two sources of truth for
the same price invite drift; deriving from the item makes consistency
structural instead of validated.

**Editable invoices and movements.** Rejected in favor of a correction
doctrine: a wrong OPEN invoice is deleted and recreated; a wrong CLOSED
invoice is corrected through the return flow, where a full return is the de
facto cancellation.

**Booking stock at invoice creation.** Rejected: it would make every draft
irreversible or force compensating logic; the OPEN/CLOSED split gives a free
staging area with one well-defined booking moment.

## Consequences

- Stock history is complete and immutable; quantity is never change-logged
  because the movement stream is the quantity history.
- Insufficient stock on closing a sale rolls back the entire close.
- Per-invoice price variability is inherent; return prices cannot vary by
  construction.

[Back to Decisions Index](index.md)
