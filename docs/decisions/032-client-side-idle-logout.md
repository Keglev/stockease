# ADR 032: Idle Sign-Out Is a Client Concern, With a Warning

**Scope**: [Cross-cutting]
**Status**: Accepted
**Date**: August 3, 2026

---

## Context

The application authenticates with a single JWT, held in `localStorage` (ADR
013), and `JwtUtil` issues it with a **ten-hour** lifetime
(`EXPIRATION_TIME = 1000 * 60 * 60 * 10`). There is no refresh token and no
server-side session record.

That design has one consequence nobody had addressed: **a token stays valid on
an unattended screen.** A user who signs in at nine and walks away at ten leaves
a browser that can act as them until seven in the evening. On a warehouse
terminal or a shared desk that is the realistic exposure, and it is not one the
backend can close - the server sees requests, and a user who has walked away
makes none. Silence is indistinguishable from a user who is reading.

The application already has an expiry experience, built for the other case: the
401 interceptor calls `auth.logout()` and navigates to `/login` with
`reason=expired`, and the login page shows `login.sessionExpired`. It is
tested and it reads correctly. What it lacks is any way to be triggered by
inactivity rather than by a rejected request.

## Decision

**Idle sign-out is implemented on the client, after 30 minutes of inactivity,
with a warning 2 minutes before, and it lands on exactly the existing
`reason=expired` destination.**

`IdleLogoutService` arms two timers and re-arms both on activity - `mousedown`,
`keydown`, `touchstart`, `wheel` on the document, plus router `NavigationEnd`.
Re-arming is throttled to once a second, because a scroll gesture would
otherwise rebuild the timers on every wheel tick; the cost is that activity in
the final second before a deadline may not register, which against a
thirty-minute window is not a distinction worth paying for.

**Both durations are product rulings, deliberately not user-configurable.** A
setting that lets a reader extend their own idle window is a setting that gets
set to "never", which is the same as not having the feature.

**The service is started by the shell**, not at bootstrap. The shell *is* the
authenticated area - it exists only behind the guard - so the timer cannot run
while a visitor reads the landing page, and it stops when the shell is
destroyed.

**The warning is a snackbar with no auto-dismiss.** A warning that disappears on
its own is worse than none: it leaves the reader signed out with no memory of
having been told. It goes when it is answered, when activity elsewhere clears
it, or when the logout it announced actually happens. Its action button counts
as activity and is reported explicitly, because that click lands inside the CDK
overlay and raises no document event the service listens for.

**The destination is byte-identical to the interceptor's** -
`router.navigate(['/login'], { queryParams: { reason: 'expired' } })`. One
expiry path, one tested experience. A second "you were signed out for
inactivity" screen would be a second thing to translate, style and keep
correct, and the user's question in both cases is the same: why am I looking at
a login form?

## Alternatives considered

**Refresh tokens with a short-lived access token.** Rejected, and this is the
decision worth being explicit about. It is the textbook answer, and it would
make idle timeout a server concern: stop refreshing, the session dies. The cost
is a second token, a rotation endpoint, refresh-race handling when several
requests expire at once, revocation storage, and a decision about where the
refresh token lives that reopens ADR 013. That is a substantial auth surface for
a portfolio inventory system whose threat model is an unattended screen. The
single-token design is a deliberate simplification, and this ADR keeps it.

**Server-side session tracking with a last-seen timestamp.** Rejected. It makes
every request a write, and it still cannot see a user who is reading rather than
clicking - the server would sign out someone in the middle of a long report
because they had not made a request in thirty minutes.

**A shorter hard token lifetime instead of an idle timer.** Rejected: it signs
out active users. Ten hours is chosen to cover a working day, and cutting it to
thirty minutes would put a login form in front of someone mid-invoice.

**No warning, just the sign-out.** Rejected. Thirty minutes is long enough that
the sign-out arrives as a surprise, and unsaved work in an open invoice form is
lost with it. Two minutes is time to finish a sentence and click.

## Consequences

- **An active user is still signed out at the token's hard limit.** The idle
  timer bounds the walk-away case; the ten-hour expiry bounds everything else,
  and someone working a long shift will meet it. When they do, the 401
  interceptor delivers them to the same screen with the same message.
- **Idle detection does not survive a closed tab.** The timers live in the page,
  so closing the browser leaves a token valid until its own expiry. The next
  request with it gets a 401 once that lapses, and the interceptor covers the
  case - but until then the token is live. Closing that hole is what refresh
  tokens are for, and this ADR declines them knowingly.
- **The idle window is not visible to the backend**, so nothing server-side can
  be reasoned about from it. Any future audit of "when did this session end"
  would see the token's issue and expiry, not the moment the client gave up.
- **The settings page now states the rule** ("You will be signed out
  automatically after 30 minutes of inactivity"), because a timeout the user
  cannot discover is one they experience only as a fault.
- **Two constants carry the design**, `IDLE_TIMEOUT_MS` and `IDLE_WARNING_MS`.
  Changing the policy is changing those two numbers, not the logic around them.

[Back to Decisions Index](index.md)
