# ADR 006: Audit and Profit Model

**Status**: Accepted
**Date**: July 23, 2026

---

## Context

Two reporting needs share a design space: tracking who changed product data,
and computing merchandise profit. Both must stay cheap to reason about and
must not leak accounting concerns into the merchandise domain.

## Decision

**Custom change log over a framework.** Product changes (name, price,
deletion, restore) publish an event; a synchronous listener writes the change
log entry in the same transaction as the change - the log row commits or
rolls back with the change it describes. Quantity is deliberately never
change-logged: the movement stream is the quantity history.

**Gross profit from stored snapshots.** Profit is sold price minus unit cost,
both taken from the immutable snapshots on movements. Prices vary per invoice
by design; a customer return reduces revenue at the original selling price.
No FIFO or AVCO cost flow is computed - stock is pooled and the snapshot
model already answers the profit question this system asks.

**Documented approximation for losses.** LOST and DESTROYED movements carry
no snapshot; loss reports value them at the product's current purchase price,
an explicitly documented approximation.

**Reporting is a CQRS-lite read model.** The report module answers
aggregations with native SQL, returns its own records, and depends on no
other module's Java types - invoice types travel as strings. It is read-only
and owns no state; this is the one documented exemption from going through
the domain model. Native SQL naturally bypasses the soft-delete restriction:
a feature for historical reports, which must include deleted products, and an
explicit filter where a report is current-state.

**Supplier profit double-counts shared products by design.** A product
supplied by two suppliers contributes its whole profit to each supplier's
row - the report answers "how profitable is the merchandise associated with
this supplier", not a partition of total profit. This behavior is pinned by a
test whose interlocking figures fail under any per-supplier allocation.

## Alternatives considered

**Hibernate Envers.** Rejected: full-entity revision snapshots and framework
coupling, where the requirement is a selective, human-readable log of a few
fields with same-transaction semantics.

**FIFO/AVCO costing.** Rejected: cost-flow accounting belongs to bookkeeping
(ADR 011); the snapshot model is sufficient for merchandise gross profit.

**Reporting through domain services.** Rejected: aggregations would drag
cross-module Java dependencies and entity graphs into what are single SQL
statements; the read model keeps module boundaries clean.

## Consequences

- Audit rows can never exist without their change, nor vice versa.
- Reports are single native queries, cheap to verify against the schema.
- The double-counting design decision is test-pinned: an accidental "fix"
  fails the suite rather than silently changing report semantics.

[Back to Decisions Index](index.md)
