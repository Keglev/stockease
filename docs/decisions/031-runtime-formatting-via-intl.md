# ADR 031: Runtime Date and Currency Formatting Through Intl, Not LOCALE_ID

**Scope**: [Frontend]
**Status**: Accepted
**Date**: August 3, 2026

---

## Context

The application shipped a latent defect from its first table onward: **every
date and every amount rendered in en-US, in both languages.**

Angular's `DatePipe` and `CurrencyPipe` read `LOCALE_ID`, which defaults to
`en-US`, and they read locale data that must be registered explicitly with
`registerLocaleData`. The application does neither - a search for `LOCALE_ID`,
`registerLocaleData` or `provideLocale` across `src` returns nothing. So a
German reader looking at the product list saw `€99.50` where they expect
`99,50 €`, and an invoice dated `12/31/2026` where they expect `31.12.2026`.

The scale was not small: 29 uses of `| currency: 'EUR'`, 9 of `| date: 'medium'`
and 5 of `| date: 'mediumDate'` - 43 renderings across 10 feature templates,
every one of them wrong in German.

The obvious repair is to register the locale data and provide `LOCALE_ID`. It
does not work here, for two independent reasons:

- **`LOCALE_ID` is fixed at bootstrap; this application changes language at
  runtime.** ADR 015 chose runtime translation over compile-time localization,
  so there is exactly one bundle and the language is a signal the user flips
  from the toolbar. A bootstrap-time locale would be whatever the app started
  with, and the toolbar toggle would retranslate every label while leaving every
  number and date in the previous language's format.
- **The formats are also a user preference.** ADR 030 established that
  preferences live per browser, and the settings page now offers explicit date
  and number overrides. An override has to be consulted *at the moment of
  rendering*, which is a decision point Angular's pipes do not have.

## Decision

**Dates and currency are formatted at runtime by `FormatService`, backed by
`Intl.DateTimeFormat` and `Intl.NumberFormat`, and reached through three
impure pipes. `LOCALE_ID` stays unset and no locale data is registered.**

`core/format/format.service.ts` owns two preferences, each defaulting to `auto`
and each persisted per browser (ADR 030):

- `dateFormat`: `auto` | `dmyDot` | `mdySlash` | `ymdDash`
- `numberFormat`: `auto` | `de` | `en`

`auto` means "follow the interface language", so the common case needs no
decision from the user and follows the toolbar toggle immediately. An explicit
date format pins **only** the order and the separators; the time of day and the
currency follow the effective number locale, because a reader asking for ISO
dates has said nothing about wanting a dot as a decimal mark.

`shared/format/` holds `appDate`, `appDateTime` and `appCurrency`, which carry
no logic and delegate to the service. **They are impure**, and that is the
whole reason they can work: their output depends on the language signal and on
a stored preference, neither of which is an argument, so a pure pipe would keep
showing the old format until its input happened to change identity. This is not
a new liberty - `TranslatePipe`, which the application uses in nearly every
template, is impure for exactly the same reason.

Formatters are **memoized per (locale, style)**. `Intl` formatters are expensive
to construct and cheap to reuse, and these are called once per table cell; a
hundred-row report would otherwise build a hundred identical formatters per
render.

The CSV export reads the same effective locale rather than the interface
language. Its field separator is keyed on that locale too, because a decimal
comma and a comma field separator cannot coexist in one file - a reader on the
English interface with German numbers selected would otherwise get a file that
opens as a single column.

## Alternatives considered

**`registerLocaleData` plus a provided `LOCALE_ID`.** Rejected for the two
reasons above, and it is worth being precise about the first: a `LOCALE_ID`
provider can be made a factory, but Angular reads it once when the injector is
created. Nothing re-renders a `CurrencyPipe` when a signal changes, because the
pipe is pure and its input has not changed. The language toggle would appear to
half-work, which is worse than not working.

**Reloading the application on language change to pick up a new `LOCALE_ID`.**
Rejected. It would make the toolbar toggle - currently instantaneous - drop the
user's place in the app, and it would still leave the format overrides with
nowhere to be consulted.

**Formatting in the components and passing strings to the templates.**
Rejected. It moves presentation into 43 call sites, and each one would have to
be re-run when the language or the preference changed. The pipe is the seam
Angular already provides for exactly this.

**A single "locale" preference instead of two.** Rejected as too coarse. The
concrete case is a German-speaking user who wants ISO dates for sorting but
German numbers for reading; one setting cannot express it, and the two
preferences are genuinely independent.

## Consequences

- **A long-standing defect is closed.** German readers now see `99,50 €` and
  `31.12.2026` where the application previously showed en-US throughout. This
  ADR records the defect because nothing else does: it was never filed, it
  simply shipped.
- **Zero raw `| date` and `| currency` pipes remain in `src/app` templates**,
  and that is worth keeping. A new raw pipe would silently reintroduce en-US for
  one column, which is exactly the kind of defect that survives review.
- **The initial bundle got smaller**, from 349.05 kB to 330.37 kB raw, because
  Angular's currency and date pipe machinery is no longer reachable. `Intl` is
  in the browser already.
- **Formatting is now a runtime call rather than a build-time fact.** The cost
  is one service lookup per rendered cell; the memoized formatters keep that to
  a map read. In exchange, language and preference changes are immediate.
- **The pipes are impure, so they run on every change detection cycle.** That is
  the accepted price of correctness here, and it is the same price the
  application already pays for every translated string.
- **`Intl` output is ICU-dependent.** Which no-break space separates an amount
  from its symbol varies between runtimes, so tests compare on code points
  rather than pinning a byte. Anything asserting on formatted output elsewhere
  should do the same.

[Back to Decisions Index](index.md)
