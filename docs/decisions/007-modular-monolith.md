# ADR 007: Modular Monolith with Spring Modulith

**Status**: Accepted
**Date**: July 23, 2026

---

## Context

The system has clearly separable domains (product, invoice, movement, audit,
reporting) but one database, shared transactions, and free-tier hosting. The
question is how to get real boundaries without distributed-system costs.

## Decision

**One deployable, enforced modules.** The codebase is organized
package-per-module (product, supplier, invoice, movement, audit, customer,
security, shared, report, plus config for global infrastructure) under Spring
Modulith. Module anatomy: the root package is the exposed API (entities,
enums, services, commands, events), repositories live in an internal
subpackage, controllers and single-consumer DTOs in a web subpackage. A
boundary test verifies the module structure on every build without booting a
context - boundaries are law, not convention. A verification lesson is part
of this decision's record: the base package itself is an implicit module and
is verified too; there is no exemption-by-location anywhere in the tree.

**Cross-module communication is calls forward, events backward.** Modules
call each other's exposed services in the natural dependency direction. Where
a call would create a cycle - invoice needing movement while movement already
calls invoice - the dependency is inverted with an application event:
invoice publishes, movement listens. Event payloads never import the
consuming module's types; shared vocabulary is mirrored by name.

**Listeners are synchronous where atomicity matters.** The invoice-close
listener books stock inside the closing transaction: close and bookings
commit or roll back together. Deletion vetoes are synchronous listeners
pinned to run before all other listeners, throwing inside the deleting
transaction to roll it back whole.

**No message broker.** Kafka was evaluated and deferred: it solves
asynchronous messaging between systems, while this is a single deployable
with one database where the interesting flows must share a transaction. A
broker would add infrastructure the hosting cannot carry and would read as
resume-driven design. Adoption triggers are named: multiple deployables,
consumers outside the transaction boundary, or event streaming to external
systems.

## Alternatives considered

**Microservices.** Rejected: distributed transactions or sagas for flows
that are naturally atomic, per-service infrastructure the free tier cannot
host, and no organizational driver - one developer, one deployment unit.

**Plain packages without enforcement.** Rejected: unverified boundaries decay
silently; the entire value of the module structure is that violations fail
the build.

**Asynchronous module listeners for stock booking.** Rejected for the close
flow: booking must be atomic with the close. Asynchronous listening remains
available where eventual consistency is acceptable.

## Consequences

- Refactoring toward services later is possible along module seams; today's
  cost stays monolith-cheap.
- The event inversion keeps the module graph acyclic and machine-verified.
- Synchronous listeners make rollback stories testable through the real
  event pipeline - a standing test requirement in this codebase.

[Back to Decisions Index](index.md)
