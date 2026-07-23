# ADR 010: Pooled Inventory - No Lot Tracking

**Status**: Accepted
**Date**: July 23, 2026

---

## Context

Lot tracking (Chargenverwaltung) records which purchase batch each unit came
from, enabling expiry management, recalls and per-lot costing. It was
evaluated as a natural next step for an inventory system.

## Decision

**Stock is pooled.** A product's quantity is one number; sales do not trace
to purchase lots. The gross-profit model (ADR 006) already answers the
costing question this system asks through per-item price snapshots, without
knowing which physical batch left the shelf.

This is a restraint decision, recorded to distinguish "not built" from
"not considered". Lot tracking multiplies the movement matrix, adds a lot
dimension to every stock query, and forces an allocation strategy on every
sale - cost with no current requirement behind it.

## Alternatives considered

**Full lot tracking.** Rejected now. Adoption triggers are named: expiry-date
management, recall traceability, or a genuine per-lot costing requirement.
Any of these reopens this decision; none exists in the current scope.

**Lot tracking for purchases only.** Rejected: half the machinery with none
of the traceability payoff - the value materializes only when sales consume
identified lots.

## Consequences

- The movement matrix stays small and fully testable.
- If a trigger materializes, lots arrive as new tables and new movement
  semantics - append-only history remains valid, since existing movements
  simply predate lot identification.

[Back to Decisions Index](index.md)
