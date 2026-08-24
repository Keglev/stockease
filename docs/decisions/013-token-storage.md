# ADR 013: JWT in localStorage, No Refresh Token

**Status**: Superseded by ADR 036 (2026-08-08) - decision unchanged; superseded by expansion: 036 adds the full threat model, grounds, and production path.
**Date**: July 28, 2026

---

## Context

Authentication is a single stateless HMAC-signed JWT with a ten-hour lifetime
(ADR 003). There is no refresh token and no server-side session to resume
from. The SPA must therefore keep that one token somewhere that survives a
page reload, or every refresh becomes a logout.

## Decision

**The token is stored in `localStorage`** and attached by an HTTP interceptor
(PR #68). The auth service is the only code that touches the storage key; the
rest of the application asks the service, never the browser.

The trade-off is stated rather than glossed: **`localStorage` is readable by
any JavaScript that runs on the origin, so a successful XSS reads the token.**
That is accepted here, and the reasons are specific to what this application
is - a demo with disposable seeded data, no third-party scripts, no analytics
or tag manager, and Angular's default output escaping across every template.
The blast radius of the accepted risk is a demo dataset, not a real one.

## Alternatives considered

**httpOnly cookie.** The correct answer for a system holding real data: the
token becomes unreadable from JavaScript. Rejected here because it is not a
storage swap - it moves the token into the backend's issuing response, and
cookies are sent automatically, which requires CSRF protection on every
state-changing endpoint plus cross-site cookie handling between the CDN origin
and the API origin. That is backend work disproportionate to a demo.

**In memory only.** Rejected: with no refresh token there is nothing to
restore from, so every reload and every new tab would land on the login page.

**Short-lived token plus a refresh token.** Rejected: it does not remove the
storage question, it duplicates it - the refresh token then needs the same
decision, and it is the more valuable credential.

## Consequences

- Reloads and new tabs stay signed in; logout clears the key.
- The token's ten-hour expiry is the only revocation mechanism, consistent
  with the stateless design in ADR 003.
- **This decision is scoped to the demo.** Any deployment holding real
  customer or pricing data reopens it, and the alternative to adopt is the
  httpOnly cookie with CSRF protection described above.

## Amendment - 24 August 2026

The token's lifetime is now two hours rather than ten. Both statements above that
give it as ten - the context describing the JWT's lifetime, and the consequence
naming that expiry as the only revocation mechanism - read two hours as of this
date. The revocation reasoning is unchanged: expiry is still the only mechanism,
and it now arrives sooner. See ADR 032's amendment of the same date for the
ground.

[Back to Decisions Index](index.md)
