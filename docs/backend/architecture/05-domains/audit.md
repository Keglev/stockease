# Module: audit

Who changed what, when - a selective, human-readable product change log with
same-transaction guarantees (ADR 006).

## Exposed API

`ProductChangeLog`, `ChangedField`, and `AuditService` (history finders by
user and by product).

## Internals

`ProductChangeLogRepository` and `ProductChangedListener` - the synchronous
listener writing the log row in the same transaction as the change.

## Events

Consumes `ProductChangedEvent`. The event's own nested field enum is mirrored
by name and mapped here - importing this module's enum into the event would
create a cycle.

## Invariants

- A log row can never exist without its change, nor a change without its row.
- Quantity and creation are deliberately never change-logged.

[Back to Domain Modules](index.md)
