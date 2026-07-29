# ADR 005: Demo Access Without Credentials

**Status**: Accepted
**Date**: July 29, 2026

---

## Context

StockEase is a portfolio application. Its purpose is to be looked at: a reviewer
should reach a populated dashboard within a click or two of the landing page,
without an account, an email confirmation, or a support conversation.

That pulls three requirements together.

Access has to be frictionless but must not mean publishing credentials. A
username and password printed on a landing page is an invitation - shared logins
get scraped, reused against other endpoints, and probed by anyone who wonders
what else the password opens.

The data has to be disposable. Every visitor arrives with a real ADMIN-shaped
tool in their hands: they can close invoices, delete products, register returns.
That is the point - a demo that only permits reading proves nothing about a
system whose interesting behaviour is all in its writes. So the changes have to
be allowed to happen and then have to go away.

And the data has to be curated. An empty database demonstrates nothing, and
randomly generated rows demonstrate less: the profit charts need margins that
differ, the due-date buckets need dates spread across the coming weeks, the
overdue report needs invoices that are genuinely late, and the low-stock view
needs a product that is genuinely low. A baseline has to be designed to show
each of those, not sampled and hoped over.

---

## Decision

**A passwordless demo login issues role-scoped JWTs for pre-migrated demo
users; a nightly reset restores a seeded baseline built through the real
service flows; and the whole surface exists only behind `app.demo.enabled`.**

`POST /api/demo/login` takes `{"role": "ADMIN"}` or `{"role": "USER"}` and
returns a signed JWT for the corresponding account - `julia.brandt` and
`markus.weber`, both created by migration. No password is involved and none is
published. The response is byte-for-byte the shape of `POST /api/auth/login`,
so the frontend reuses its existing authentication handling unchanged.

`POST /api/demo/reset` wipes every domain table and rebuilds the baseline. It is
authenticated by a shared secret in the `X-Demo-Reset-Token` header rather than
by a JWT, because the caller is a scheduler and holds no user account. The same
rebuild runs once at startup when the catalogue is empty, so a fresh deployment
never greets its first visitor with blank dashboards.

The baseline is seeded exclusively through the public services - product,
supplier, customer, invoice, movement. Nothing is inserted directly. Invoices
are created and then genuinely closed, so stock books through the real listener,
price snapshots land where the reports read them, and the audit trail fills with
the same rows a user's actions would have written. Demo data that took a
shortcut around the domain would be demo data that does not prove the domain
works.

`app.demo.enabled` defaults to false. With it false, no demo bean is created,
which means no controller is mapped and the `/api/demo` paths answer 404 rather
than presenting a protected surface that answers 403.

---

## Alternatives Considered

**Printed credentials on the landing page** - rejected. It adds friction where
the whole point is removing it: the visitor has to read, copy, and type. Worse,
it publishes a working login pair, which invites exactly the abuse of shared
credentials that a public demo should not host.

**An OAuth demo tenant** - rejected. An identity provider, a tenant to
configure, a client registration to keep in sync, and a redirect flow to debug,
all to avoid asking a visitor to click a button. The infrastructure is
disproportionate to what it buys for a demo.

---

## Consequences

Anyone can hold a demo ADMIN token. This is accepted: the data behind it is
disposable and nightly-restored, and the accounts it names exist only in the
demo deployment.

The demo ADMIN is a genuinely role-promoted account - migration V15 sets
`julia.brandt` to `ROLE_ADMIN` - not a token-level elevation, so authorization
behaves identically for demo and real users and no code path treats a demo
session as a special case.

Personal and real accounts are provisioned outside this repository through an
environment-based bootstrap. They are never part of the reset: the wipe touches
domain tables only and leaves `app_user` untouched by construction, which is
pinned by a test comparing the table row by row across a reset.

Daytime visitor changes are ephemeral by design. Anything a visitor does
survives until the nightly reset and no longer. That is a feature of the demo,
not a limitation of it - but it does mean the demo is not a place to keep
anything.

---

[Back to Decisions Index](index.md)
