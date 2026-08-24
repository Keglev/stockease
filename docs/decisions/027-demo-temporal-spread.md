# ADR 027: Deterministic Temporal Spread of Demo Data

**Scope**: [Cross-cutting]
**Status**: Accepted
**Date**: July 30, 2026

---

## Context

The demo seeder builds its baseline exclusively through the real services (ADR
021 and the module-ownership line the whole demo module holds). That is the
right way to build it — every unit of stock has a document behind it, every
price derives from a close — but it has one consequence nobody designed:
**every row is stamped with the instant the seed ran.**

So the entire business history of the demo lives in a single moment. Invoices
created seconds apart, movements booked by their closes, the payments applied
afterwards, the price changes the closes wrote — all within one second of each
other, roughly 180 days' worth of narrative compressed to a point.

The production review found what that costs:

- The period presets on the profit and cash-flow tabs — 30 days, 90 days, this
  year, all — **return identical results**. Every window contains everything,
  so the control appears broken. The feature that shipped two slices ago cannot
  be demonstrated by the data it was built to filter.
- Any time series over this baseline is **a single point**. The charts that
  would plot booking or payment activity over a period have nothing to plot.
- The `Erstellt am` column reads as one timestamp repeated eighteen times,
  which reads as test data rather than a business.

Due dates are the one exception, and deliberately so: the seeder places them
relative to today precisely because the overdue and due-soon reports need
populated windows. Those anchors already work.

## Decision

**After the service-driven seed completes, the demo module backdates the
finished baseline across the past ~180 days, by direct SQL, using a fixed
offset table.**

- Each seeded invoice has a **fixed age in days**, listed in one constant table
  keyed by invoice number. Its creation, its close, the movements that close
  booked, and the price-change rows it wrote all move back by that same amount.
- Settlements are placed a **small fixed lag** (1–3 days, varied per invoice)
  after the shifted close, so a payment can never precede the invoice it pays.
- The two write-offs hang off no invoice and carry **their own offsets**.
- Each product is pulled back to **shortly before the first movement that
  touches it**, derived rather than assigned, so a catalogue entry can never
  postdate the delivery it received.
- **Due dates are not touched.** They are designed anchors, not history.
- **No value moves** — quantities, prices, unit costs and statuses are exactly
  what the seeder decided. This step moves time and nothing else.

Two properties of the mechanism are load-bearing:

**Shifts are relative, not absolute.** Each statement subtracts an interval
from a row's existing timestamp instead of assigning it a computed moment. The
seed already wrote its rows in causal order within that one instant, so
subtracting one constant per invoice moves the whole group without reordering
anything inside it. Intra-invoice ordering is preserved by construction rather
than by arithmetic that could be got wrong.

**It runs as direct SQL from the demo module.** Rewriting audit timestamps is
not behaviour any business service offers or should. The demo module is already
the place that legitimately reaches across module tables — the nightly wipe
truncates seven of them for exactly this kind of reason — and this step extends
that precedent rather than setting a new one.

The step ends with a **verification query** that fails loudly if any movement
predates its product, any payment predates its invoice, or any history landed in
the future. The seeder already refuses to leave a partial baseline behind;
incoherent history deserves the same treatment, because it would not break a
page — it would quietly make the demo argue against the invariants the
application enforces everywhere else.

## Alternatives considered

**Thread explicit timestamps through the production service signatures.**
Rejected. `createInvoice`, `close`, `recordMovement` and `markAsPaid` would each
grow a clock parameter, or the application would grow an injected `Clock`, so
that one non-production caller could ask for a date in the past. That is a demo
concern pushed into four production APIs and into every test and call site that
touches them. It is also the more "correct-looking" option, which is worth
recording as the cost of this decision: the SQL here duplicates knowledge of
which tables carry timestamps, and that duplication is the price of keeping the
production surface clean.

**Randomised offsets.** Rejected, and this is the sharper of the two. A
randomised spread would look more natural and would make the baseline
unreproducible — "what does the demo show?" would have no answer, the pinned
guarantees would hold only probabilistically, and a failing integration test
could not be reproduced from the same seed. The demo baseline is a contract.
Every number in the offset table is fixed, and there is no random source
anywhere in the path.

**Clock manipulation, Testcontainers-style.** Rejected because it does not
exist. The timestamps come from PostgreSQL's `now()` column defaults and from
JPA auditing inside a live application; there is no seam to freeze or advance a
running database's clock across a sequence of committed service calls, and
faking the JVM clock would not move the DB defaults.

**Shift the due dates too, for consistency.** Rejected. Due dates are what put
invoices into the overdue and due-soon windows, which are pinned guarantees.
Moving them would empty exactly the reports the seeder works hardest to
populate.

## Consequences

- Seeded `Erstellt am` dates now read as **months of trading history** rather
  than one repeated timestamp.
- The **period presets differ**: profit filters on movement dates (booking
  basis) and cash flow on payment dates (ADR 025), and the offset table places
  activity in the 30-day, 90-day and older-than-90 bands for both — so the two
  filters answer differently from each other as well as across windows.
- **Time-series features can be built against the demo.** The charts that were
  unbuildable now have a distribution to draw.
- **The offset table is the single place the shape of history is tuned.**
  Changing when something happened is one number, not a rewrite. Its comment
  carries the three constraints any edit has to preserve: purchases before the
  sales that draw on them, all three booking bands populated, all three payment
  bands populated.
- The step **duplicates knowledge** of which columns carry timestamps. A future
  table with its own `created_at` will not be spread until it is added here —
  accepted deliberately over the alternative of a clock parameter on four
  production methods.
- Nothing about the API changes: **no spec bump, no migration, no frontend
  work.** The same endpoints return the same shapes over better-distributed
  data.

## Amendment - 24 August 2026

The reset is weekly as of this date (ADR 005), not nightly, and the wipe this
record describes now runs on Mondays. The spread mechanism is unchanged: fixed
offsets, applied from the reset moment.

The invariant this record turns on - all three period bands populated - survives
the change, and the margin is worth stating. Between resets every seeded date
ages
by up to seven days. Two invoices cross a boundary at the end of the week:
WP-2026-0091 at 24 days reaches 31 and leaves the 30-day band, and AR-2026-0004
at
88 reaches 95 and leaves the 90-day band, which also thins the 30-day cash-flow
set
from three settlements to two. Every band still holds members throughout the
week,
so the presets keep returning visibly different result sets, which is what the
invariant exists to guarantee.

The margin on the outer bound is twelve days: the oldest offset is 168 and
reaches
175 against a 180-day limit. That is what makes weekly safe and fortnightly not
-
at a fortnight the oldest invoice falls out of the reports altogether, and the
offset table would have to be re-tuned rather than the cron alone.

[Back to Decisions Index](index.md)
