# ADR 008: Documentation Structure

**Status**: Accepted
**Date**: July 23, 2026

---

## Context

The documentation grew organically into a flat tree of topic folders with an
ad-hoc structure, a hand-written HTML template and a bespoke build script. It
had no stable place for runtime views or cross-cutting concepts, no German
entry point, and its navigation was hardcoded inside the page template. With
the frontend moving into this repository, the documentation also needed a
backend/frontend split that the flat tree could not express.

## Decision

Adopt **arc42** as the structural standard for architecture documentation,
organized as docs/backend/architecture/ (and later frontend/) with numbered
sections 02-12, a one-page overview as the entry point, English and German
landing pages, and ADRs under 09-decisions/. The presentation layer and build
pipeline are ported from a proven sibling project rather than redesigned:
markdown renders through themed HTML shells with navigation partials, and the
site deploys to GitHub Pages via a dedicated workflow.

## Alternatives considered

**Keep the ad-hoc structure.** Rejected: every new topic required a structural
decision; readers had no standard map; the German market context makes arc42
- widely used in German engineering organizations - the stronger signal.

**Diátaxis.** A strong framework for product documentation (tutorials,
how-tos, reference, explanation), but this site documents architecture for
technical reviewers, not product usage for end users. arc42's
building-blocks/runtime/decisions cut fits that audience directly.

**Hand-written custom theme.** Rejected: presentation is not the portfolio's
subject. Porting a working theme and pipeline keeps the effort on content.

## Consequences

- Architecture content has a fixed home; section fills are mechanical.
- ADRs live inside the arc42 tree (section 9), migrated append-only.
- The legacy tree under docs/architecture/ is frozen and will be retired once
  its remaining content is migrated into the arc42 sections.
- German-language entry pages are first-class, matching the project's target
  audience.

[Back to Decisions Index](index.md)
