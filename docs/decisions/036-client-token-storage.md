# ADR 036: Client Token Storage and Its Accepted Threat Model

**Scope**: [Cross-cutting]
**Status**: Accepted; supersedes ADR 013
**Date**: August 8, 2026

---

## Context

Where the browser keeps the session token was decided early and recorded in ADR
013, which chose `localStorage` and named the XSS consequence. What that ADR did
not do is state the rest of the exposure, cite the guidance it is departing
from, or describe what a real deployment would change. A reader arriving at it
in a security review finds a decision and a single risk, and has no way to tell
whether the other risks were considered and accepted or simply never thought
about.

They were considered. This ADR is the single live record: it restates the
decision unchanged and supplies what was missing around it. ADR 013 is
superseded by expansion, not by reversal.

The choice is also less free than it looks. Authentication is one stateless
HMAC-signed JWT with a ten-hour lifetime (ADR 003), with no refresh token and no
server-side session to resume from. A single-page application must survive a
reload, so that one token has to live somewhere the page can read after a
refresh - which is precisely the property that makes it reachable by anything
else running on the origin.

## Decision

**The bearer JWT is stored in `localStorage` under `stockease.token`**, attached
to outgoing requests by an HTTP interceptor. The auth service is the only code
that touches the key; everything else asks the service rather than the browser.

**The token's ten-hour expiry is the containment boundary.** There is no
revocation list and no server-side session record, so a token is valid until it
lapses and nothing can shorten that from the server side.

**Idle sign-out runs on the client after 30 minutes of inactivity, with a
warning 2 minutes before** (ADR 032). It clears the local copy and returns the
reader to the login screen.

**Refresh tokens and server-side revocation are deliberately not built.** A
refresh token does not answer the storage question, it asks it twice: the second
token needs a home too, and it is the more valuable of the pair because it mints
successors. ADR 032 reaffirmed this when it chose a client-side idle timer over
making idleness a server concern.

## The accepted threat model

Stated plainly, because a risk that is written down can be weighed and one that
is not cannot:

- **Any script executing on the origin can read the token.** A successful XSS
  exfiltrates it in one line. Angular escapes template output by default and the
  application loads no third-party scripts, no analytics and no tag manager,
  which narrows the ways such a script could arrive - it does not eliminate
  them.
- **`localStorage` is written to disk.** It survives browser restarts and lives
  in the browser profile directory, so malware running as the user, or anyone
  with read access to that profile, can lift the token without touching the
  running page.
- **Anyone at the keyboard can read it.** Two clicks in DevTools display the
  token. There is no protection here against physical access to an unlocked
  machine, only the idle timer.
- **A copied token is indistinguishable from the real session.** The backend
  validates a signature and an expiry; it does not bind the token to a device,
  an IP or a client fingerprint. Until `exp` passes, a stolen copy is the
  session, and the legitimate user sees nothing.
- **Idle sign-out is a user-experience measure, not revocation.** It clears the
  local copy on that one screen. A token already copied elsewhere keeps working
  for the remainder of its ten hours, and the backend never learns that a
  sign-out happened.

This is a departure from current guidance, and the departure is deliberate. The
OWASP JWT for Java Cheat Sheet and Session Management Cheat Sheet both direct
that session tokens be held in cookies marked `httpOnly`, `Secure` and
`SameSite` rather than in web storage, for exactly the first reason above: web
storage is script-reachable by design, and the `httpOnly` flag exists to take
that reach away. The BSI's web-application guidance reaches the same conclusion
from the other direction, treating a token the client script can read as a
credential that must be assumed disclosed once any script injection succeeds.

## Why it is accepted here

The asset does not justify the infrastructure. This is a portfolio inventory
system: the data is seeded demo content, reset nightly (ADR 005), holding no
real customer, pricing or personal information. The realistic worst case of a
stolen token is that someone edits a demo dataset that will be overwritten
before morning.

Against that, revocation is not a flag to enable. It means an issuing endpoint
that sets cookies, a rotation endpoint, refresh-race handling for the case where
several requests expire together, storage for revoked or rotated tokens, CSRF
protection on every state-changing endpoint, and cross-site cookie handling
between the CDN origin and the API origin. That is a substantial and permanent
increase in auth surface - more code to get wrong, in the part of the system
where being wrong matters most - bought to protect data that is thrown away
daily. The ten-hour expiry and the idle timer are proportionate to what is
actually at stake.

The reasoning is scoped to that fact and expires with it. **Any deployment
holding real data reopens this decision**, and the replacement is not a
preference but the path below.

## The production path

What a deployment with real users changes, in order:

1. **Move the token out of script reach.** The backend issues it as a cookie
   marked `httpOnly`, `Secure` and `SameSite`, so the browser attaches it and no
   script can read it.
2. **Shorten the access token and add rotating refresh tokens.** A short-lived
   access token with a refresh token that is replaced on every use, and **reuse
   detection** - a refresh token presented twice means one of the two holders is
   an attacker, and the correct response is to invalidate the whole family and
   force re-authentication.
3. **Add server-side revocation**, so sign-out, a password change or an
   administrator action ends a session immediately rather than at `exp`.

In this codebase specifically, that means: the auth interceptor stops attaching
an `Authorization` header and the auth service stops holding a token at all,
because the browser now carries it; the CORS configuration gains credentialed
handling, which forbids the wildcard origin and requires the exact origins to be
enumerated; and **CSRF protection returns** to every state-changing endpoint,
because a cookie the browser attaches automatically is a cookie an attacker's
page can cause to be attached too. The Spring Security configuration currently
disables CSRF on the strength of the bearer-header design; that line is only
correct while this ADR holds.

## Alternatives considered

**`httpOnly` cookie now.** The correct answer for a system with real data, and
the first step of the path above. Rejected for the current scope because it is
not a storage swap: it moves the token into the issuing response and pulls CSRF
protection and cross-origin cookie handling in with it - backend work
disproportionate to a demo whose data resets nightly.

**In memory only.** Rejected. With no refresh token there is nothing to restore
from, so every reload and every new tab would land on the login page. It trades
the accepted risk for a broken experience rather than for a stronger session.

**Session storage instead of local storage.** Rejected as security theatre in
this context. It is equally script-reachable; it only shortens persistence to
the tab's lifetime, which costs the surviving-reload property the design needs
while leaving the XSS exposure exactly where it was.

**A shorter hard token lifetime.** Rejected in ADR 032 and not revisited here: a
lifetime short enough to matter as containment signs out an active user
mid-task, which is why the idle timer carries that concern instead.

## Consequences

- Reloads and new tabs stay signed in; sign-out clears the key.
- The ten-hour expiry remains the only true revocation mechanism, consistent
  with the stateless design in ADR 003.
- A security review of this repository will find web-storage token handling and
  should find this ADR first. The finding is real, recorded, and accepted with
  its reasons - not missed.
- ADR 013 is superseded by this document. ADR 032's remark that refresh tokens
  would "reopen ADR 013" is accurate as written and now points at this thread.
- The disabled CSRF configuration is coupled to this decision, and the two move
  together: whoever adopts cookie transport must re-enable it in the same
  change.

## Amendment - 24 August 2026

The containment boundary this record reasons from is now two hours rather than
ten: `JwtUtil` issues the token with `EXPIRATION_TIME = 1000 * 60 * 60 * 2`.
Every statement above that gives the boundary as ten hours - the lifetime in the
context, "the token's ten-hour expiry is the containment boundary", the stolen
token living out "the remainder of its ten hours", and the expiry named as the
only true revocation mechanism - reads two hours as of this date.

The reasoning is unchanged and tightens with the figure. A token readable by
script on the page is contained by how long it stays useful, and it now stays
useful for a fifth as long. Nothing about the storage decision, the absence of a
refresh token, or the conditions under which a cookie transport would be adopted
is affected. See ADR 032's amendment of the same date for the ground.

[Back to Decisions Index](index.md)
