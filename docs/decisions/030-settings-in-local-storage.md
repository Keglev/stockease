# ADR 030: User Preferences Live in localStorage, Not on the Server

**Scope**: [Frontend]
**Status**: Accepted
**Date**: August 3, 2026

---

## Context

The application now has a settings page, which collects preferences that until
today were scattered across the toolbar: the colour scheme and the interface
language, with number and date formats to follow.

Gathering them in one place raises a question that two separate toggles never
had to answer out loud: **where does a preference live?**

Both existing preferences already answer it the same way, and have since they
were built. `ThemeService` writes `stockease.theme` and `LanguageService` writes
`stockease.lang`, each to `localStorage`, each seeding itself from storage at
startup and falling back to a sensible default - `prefers-color-scheme` for the
theme, a fixed language otherwise. Neither has ever asked the backend anything.

A settings page invites the opposite assumption. Settings pages in most
applications write to a user profile, and the API has a user table sitting right
there. Making that the default without deciding it would mean the first
format preference in V6b quietly acquires a `PUT /api/users/me/preferences`, a
DTO, a migration, an authorization rule and a set of tests - and the theme and
language would then be inconsistent with it, or would have to be migrated too.

## Decision

**User preferences are per-browser state in `localStorage`. There is
deliberately no user-preferences endpoint, and none is planned.**

This covers the colour scheme, the interface language, and the number and date
formats V6b adds. Each is read and written through the service that owns it;
the settings page holds no state of its own and is only another caller of those
services, exactly as the toolbar toggles are. A change made on the settings page
and a change made from the toolbar are the same event, because they are the same
method call.

Three properties make this the right shape rather than merely the cheap one:

**A preference is presentation-local, not a fact about the user.** "Dark" is a
statement about this screen in this room, not about the person - the same person
wants dark on the laptop at night and light on the shared monitor in the office.
Storing it against the account would make the two devices fight over one value.

**The round trip buys nothing.** A server-held preference has to be fetched
before the first paint or applied late, which means either blocking startup on a
request or letting the app flash the wrong theme and then correct itself. Local
storage is synchronous and already read during bootstrap, so the first render is
correct.

**It is where the answer already was.** The theme and the language have been
stored this way since they existed. This ADR does not introduce the pattern; it
declines to abandon it, and writes down why, because a settings page is exactly
the moment somebody would.

## Alternatives considered

**A backend profile endpoint.** Rejected. It adds an endpoint, a schema change,
an authorization question and a failure mode - what the app does when the
preferences call fails but the session is fine - in exchange for roaming a
value that is mostly not worth roaming. It would also make the demo worse: the
nightly reset would either wipe a visitor's chosen theme along with the business
data, or need an exception carved out to avoid doing so.

**Cookies.** Rejected. Cookies are for state a server needs to read, and no
server here reads these. They would travel on every API request for nothing,
and they are a consent-notice question in some jurisdictions that `localStorage`
holding a colour scheme is not.

**A hybrid - local first, synced to the server when signed in.** Rejected as the
worst of both: it has the endpoint, plus a conflict-resolution rule for what
happens when the local value and the stored value disagree, which is a question
nobody wants to answer about a colour scheme.

## Consequences

- **Preferences do not roam.** A user who signs in on a second device gets the
  defaults there and sets them again. This is the cost, it is accepted, and it
  is the direct consequence of treating the preference as belonging to the
  browser rather than to the account.
- **The demo's nightly reset does not touch them.** The reset truncates business
  tables; a visitor's theme and language are not in the database and therefore
  survive it. A visitor who set dark mode at 02:00 still has dark mode at 04:00,
  with a fresh dataset behind it.
- **Clearing site data resets preferences**, and private-browsing windows start
  from the defaults every time. Both services already tolerate storage being
  unavailable - they catch and keep the in-memory choice - so the app degrades
  to "preferences for this session only" rather than breaking.
- **The settings page stays thin.** It has no state, no save button and nothing
  to persist; every control writes through to the owning service and takes
  effect at once. Adding a preference means adding a service and a control, not
  a round trip.
- **If roaming is ever wanted, this is the decision to revisit** - not a gap to
  patch around. The revision would add an endpoint and a sync rule for every
  preference at once, rather than one preference growing a server side of its
  own while the others keep theirs local.

## Amendment - 24 August 2026

The demo reset is weekly as of this date - Mondays at 03:00 UTC - not nightly
(ADR 005). Both references to the nightly reset - the one it would wipe a theme
along with, and the consequence that the reset does not touch stored preferences
- read weekly. The reasoning above is unaffected; only the interval changes.
See ADR 005's amendment of the same date for the ground and the accepted cost.

[Back to Decisions Index](index.md)
