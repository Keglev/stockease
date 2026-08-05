# ADR 034: No Forced Password Expiry

**Scope**: [Cross-cutting]
**Status**: Accepted
**Date**: August 5, 2026

---

## Context

The application has no mechanism that makes a password stop working after a set
number of days, and no screen that demands a new one on login. That absence has
never been written down, which makes it look like an oversight in a security
review - the sort of gap a reviewer closes by adding a ninety-day counter,
because periodic rotation is what a checklist expects to find. It is not an
oversight, and this ADR is here so the next reader knows that.

## Decision

**Periodic forced password rotation is deliberately not implemented.** Passwords
change when a user chooses to change one, or when there is reason to believe a
credential has been exposed - not on a calendar. This follows the current
guidance rather than the older convention: NIST SP 800-63B directs verifiers not
to require arbitrary periodic changes and to force a change only on evidence of
compromise, and the BSI removed the periodic-change recommendation from
IT-Grundschutz in 2020 on the same reasoning. Both reached it from the same
observation: a user made to produce a new password every quarter produces the
old one with the number at the end incremented, so the rotation buys a
predictable transformation of an already-known secret while costing the user a
password they can no longer remember. A strong password that survives is worth
more than a weak one that changes.

## Consequences

The session-security posture is carried by measures already on record rather
than by expiry. Token lifetime is bounded at ten hours with no refresh token, a
simplification argued in ADR 013 and reaffirmed in ADR 032; the walk-away case
is closed by the client-side idle sign-out decided in ADR 032; and the
administrator account is provisioned from environment secrets
(`APP_BOOTSTRAPADMIN_USERNAME` / `APP_BOOTSTRAPADMIN_PASSWORD`), with no
committed default credential to rotate away from. What this decision does not
provide is a way to end a specific user's access before their token lapses -
that remains the gap ADR 003 records under token invalidation, and rotation
would not have closed it either, since an already-issued JWT keeps validating
regardless of the password behind it. If a credential is ever known to be
exposed, the response is an immediate change of that password and, where the
signing secret is implicated, a rotation of it - a deliberate action on
evidence, which is exactly what the periodic version is not.

[Back to Decisions Index](index.md)
