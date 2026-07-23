# Solution Strategy

Four strategic choices shape everything else. Each has a decision record;
this page is the map.

## One deployable, real boundaries

The domain decomposes cleanly, but the flows that matter share transactions
and one database. So: a modular monolith under Spring Modulith, with
boundaries enforced by a build-time test rather than by network calls
(ADR 007). Microservices were rejected for cost without driver; the module
seams keep that door open.

## The invoice lifecycle books the stock

Stock never changes by direct edit. Invoices are drafted OPEN, and closing
them is the booking act: an event, a synchronous listener, one movement per
item, all in the closing transaction (ADR 004). Everything downstream -
derived price snapshots, append-only corrections via returns, the single
locked quantity path - follows from making the document lifecycle the only
source of stock truth.

## Reads that need no model go around it

Aggregation questions (profit, stock status, due dates) are answered by a
CQRS-lite read model: native SQL, own result records, zero Java dependencies
on other modules (ADR 006). The write model stays clean of reporting
concerns; the one exemption from the domain model is bounded and documented.

## The schema has one owner

Flyway owns the schema down to exact DDL - numeric precision, partial unique
indexes - and Hibernate only validates. Applied migrations are immutable.
This is what makes database-level guarantees (CHECK constraints,
partial indexes) first-class design tools rather than generator artifacts.

## What was deliberately left out

Restraint decisions are part of the strategy: no message broker (ADR 007),
no lot tracking (ADR 010), no financial calculations beyond the payment fact
(ADR 011). Each names its adoption triggers - the boundary between "not
built" and "not considered".

[Back to Architecture Index](index.md)
