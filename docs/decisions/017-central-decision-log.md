# ADR 017: Central Decision Log at the System Level

**Status**: Accepted
**Date**: July 29, 2026

---

## Context

The decision log began inside the backend arc42 tree, at section 9, because
ADR 008 put it there when the backend was the only documented tier. That
address was correct for what the log then held.

The frontend build-out changed what it holds. ADRs 012 to 016 decide frontend
hosting, token storage, i18n and charting, and 014 decides the contract seam
between the two tiers. A sequence that records decisions for the whole system
was living at an address that claims it belongs to one tier.

## Decision

**One central log at `docs/decisions`, with a single numbering.** Every
architecture decision in this repository - backend, frontend or cross-cutting
- enters the same sequence at the same address. Entries carry a scope tag so a
reader can filter by tier without the tiers owning separate logs.

**Each architecture tree's section 9 becomes a pointer page.** The arc42
section stays present, so the structure the standard defines is intact and
navigable; its content is a sentence and a link to the central log. This is
arc42's own guidance for content that belongs elsewhere: refer to it, do not
duplicate it.

## Alternatives considered

**A decision log per tier.** Rejected: it splits one interdependent sequence.
ADR 013's token storage is the frontend half of ADR 003's authentication
mechanism, and ADR 014 is a contract between the tiers - filed under one tier,
each becomes invisible from the other. Cross-cutting decisions like ADR 008
would have no home at all, and two logs numbering independently would produce
two different ADR 012s.

**Leave the log where it is.** Rejected on timing rather than on principle.
The frontend documentation tree is not built yet; every link it would grow
into the log would point at an address inside the backend tree, and each one
would have to be rewritten later. The move is cheapest now, before those links
exist.

## Consequences

- ADR 008's location clause is superseded; its status records that, and its
  text is left as written - the log is append-only.
- The frontend documentation tree will be born with a pointer section 9
  rather than a log of its own.
- External deep links to an ADR at its old address break. Accepted: the site
  is young, the log is reachable from both landing pages and from every
  architecture tree, and permanent redirects are not worth a build step for
  the audience this documentation has today.

[Back to Decisions Index](index.md)
