# ADR 015: Runtime Translation over Compile-Time Localization

**Status**: Accepted
**Date**: July 28, 2026

---

## Context

The application ships in English and German, and the two must be switchable
from inside the running application - a visitor changing language expects the
current page to change, not a reload onto a different site.

Angular offers two answers. `@angular/localize` extracts messages at build
time and produces one bundle per locale. `ngx-translate` loads a JSON message
file at runtime and resolves keys through a pipe.

## Decision

**Runtime translation with `ngx-translate` 18** (PR #72). One bundle serves
both languages; the locale files are static JSON fetched on demand. The
startup language resolves in a fixed order: **stored preference, then browser
language, then English** as the fallback. The chosen language is persisted, so
it survives a reload.

Backend messages stay English by design. Validation and error text crosses the
API as server-authored strings; translating them would mean either a message
catalogue in the backend or key-matching in the frontend against text the
backend is free to reword. The UI translates its own surface.

## Alternatives considered

**`@angular/localize`.** Rejected on the requirement, not on quality: it binds
the locale at build time, so switching means navigating to a separately built
application. It also multiplies build outputs and deployment paths by the
number of locales.

**Hand-rolled translation service.** Rejected: it is `ngx-translate` with the
missing-key handling, parameter interpolation and loader plumbing still to be
written.

## Consequences

- Trade-off: no compile-time message checking; mitigated by a CI-enforced
  key-parity test between the locale files (see the translation parity spec),
  which fails the build when the two files diverge in key set or key order.
- One bundle, one deployment, and language is a user preference rather than a
  URL.
- Adding a locale is adding a JSON file and an entry in the supported list;
  no build configuration changes.

[Back to Decisions Index](index.md)
