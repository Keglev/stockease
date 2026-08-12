# Cross-cutting Concepts

Mechanisms that hold across every feature. Each concept links to the decision
record carrying its full rationale.

## Translation

Keys resolve at runtime through ngx-translate, not at compile time (ADR 015).
One bundle per language is fetched at startup from `/i18n/<lang>.json`, and
bootstrap waits for it so no page renders raw keys. The consequence worth stating
plainly: nothing in the compiler or the production build notices a key that
exists in one language and not the other - the application simply renders the key
itself to whoever switched.

Two gates stand in for the check the compiler cannot perform.

**Parity.** A spec reads both shipped bundles from disk and fails naming the
diverging paths. It pins ordering as well as membership: the two files are kept
byte-parallel so a side-by-side diff shows only translated values, and a key
appended to the end of one file would preserve membership while destroying that
property.

**Drift.** The shipped bundles are assembled artifacts, not authored ones. Each
namespace is authored as its own file per language and an ordered manifest
governs key order; a build step re-assembles and CI fails on any difference
(ADR 037). Hand-editing a shipped bundle cannot reach `main`.

### Protected dynamic subtrees

Some keys are never written out in full. A template concatenates a prefix with a
value from the data - `'invoices.status.' + invoice.status` - so the complete key
exists only at runtime.

There are **12 such prefixes across 28 construction sites**: `audit.field.*`,
`help.topics.*`, `invoices.status.*`, `invoices.type.*`, `landing.features.*`,
`landing.screenshots.*`, `landing.steps.*`, `movements.directionHint.*`,
`movements.form.remarkOption.*`, `movements.reason.*`, `settings.language.*` and
`shell.role.*`.

A thirteenth family, `*.columns.*`, is built differently and therefore has to be
found differently: the CSV export service appends a column identifier to a
`keyPrefix` argument its callers pass, so the prefix is a variable rather than a
literal. Six prefixes reach it - `customers.columns.`, `invoices.columns.`,
`suppliers.columns.`, `reports.columns.`, `reports.cashFlow.columns.` and
`reports.changes.columns.`.

This is why an orphan scan - anything looking for keys no code references - must
exclude these subtrees **by construction site**, not by listing the keys it
expects. A scan that searched for literal key strings would report every leaf
under all thirteen families as unused and be wrong about all of them. The
namespace-per-file authoring split is chosen partly for this reason: every one of
these prefixes resolves inside a single top-level namespace, so no authoring
boundary can cut one.

## Formatting

The application registers no `LOCALE_ID` and no locale data. That is deliberate:
`LOCALE_ID` is fixed at bootstrap while this application changes language while
running, so a registered locale could not follow the switch (ADR 031).

`FormatService` decides per call instead. Two preferences, date and number, each
default to `auto` and are stored per browser (ADR 030). `auto` means "follow the
interface language"; an explicit date format pins field order and separator only,
while time of day and currency follow the effective number locale. Currency is
euro throughout.

Three pipes render through it - `appDate`, `appDateTime` and `appCurrency` - and
all three are declared `pure: false`. Purity is the whole point. A pure pipe
re-evaluates only when its input reference changes, and neither a language switch
nor a preference change touches the row objects a table is bound to, so every
already-rendered date and amount would keep its old formatting until something
unrelated replaced the data. Impure pipes re-evaluate on each change detection
cycle, which is what makes the switch visible immediately.

Two things are not pipes and need their own handling. Chart options are plain
objects built once, so they depend on a computed chart context that rebuilds them
when language, number format or theme moves. Material's paginator reads its
labels as properties, so a provider re-resolves them on language change and emits
`changes` to repaint paginators already on screen.

## Theming

Colour comes from Material 3 system tokens - the `--mat-sys-*` custom properties
- and from nothing else. Light and dark are one switch: Material emits every
system colour through `light-dark()`, so setting `color-scheme` on the root
element repaints the entire application. The choice resolves from storage at
startup, falling back to the operating system's `prefers-color-scheme`.

Literal colours are sanctioned in exactly two places, both because M3 defines no
role for the semantics involved:

- **The gauge ramp** in `shared/chart/chart-context.ts` - three red-amber-green
  values per theme. M3 defines no success or warning role, so no token spells
  this ramp; and a gauge paints to canvas, outside the DOM cascade where a custom
  property would resolve, so a token could not be read there even if one existed.
  The dark row is the same ramp lightened, because the light values read as muddy
  against a dark plot area.
- **The health indicator** in the footer's stylesheet - one `light-dark()` pair
  for "API up", for the same missing-success-role reason. It is declared once as
  a component-level custom property rather than repeated inline, and it is that
  component's only literal colour.

Both carry the reasoning in the file. Anywhere else, a hex literal is a finding.

## Reporting failures to the reader

Backend responses mostly arrive in a `success` / `message` / `data` envelope,
which feature services unwrap - not the interceptor, because the report endpoints
return their payload directly. The error interceptor converts any failed response
into an `ApiError` carrying the message, the HTTP status, and the envelope's
optional machine-readable `code`. A status of `0` means the request never reached
the server, so no consumer can mistake a network failure for one the backend
chose.

The `code` is the discriminator where a caller has something specific to say. The
returns flow on the invoice detail page is the worked case: `PRODUCT_DELETED` and
`INSUFFICIENT_STOCK` arrive with the same HTTP status but call for opposite
advice, so each maps to its own translation key.

Everything else - no code, an unrecognised one, or a failure that is not an
`ApiError` at all - falls through to the backend's own message, displayed
verbatim. The same rule governs notifications: `NotificationService` translates
anything that resolves as a known key and shows anything else as written, because
echoing a raw key at the reader is worse than showing the server's sentence.
Backend messages are not translated, and this fall-through is where they surface.

Consumers branching on a code must treat "absent" and "a value I do not
recognise" as the same case, because the API adds codes to responses that
previously carried none.

## Notifications and confirmation

Two shared mechanisms keep transient feedback and destructive prompts uniform.

`NotificationService` is the single place a transient message is raised, so
success and failure read the same everywhere: a snackbar, three seconds for
success and five for failure. It is used by the operations that change data -
product create, rename, reprice, delete and restore, the customer and supplier
registers, and invoice actions.

`ConfirmDialogComponent` is a generic confirmation carrying nothing
domain-specific: callers hand it translation keys for title, message, optional
interpolation parameters and an optional caveat line, and it resolves to a
boolean. It guards the irreversible or near-irreversible actions - deletions
across the registers, and the invoice lifecycle steps.

## CSV export

Exports are built in the browser from rows the page already holds (ADR 023).
`CsvExportService` is deliberately thin: it resolves the header keys, reads the
effective number locale, and hands the file over. What it centralises is that all
three must happen at **click time** - a cached header row or a locale read at
construction would produce a file in the language the page was opened in rather
than the one it is being read in.

Three details are load-bearing, and each exists because a spreadsheet got it
wrong:

- **The field separator follows the number locale**, not the interface language:
  comma for `en-US`, semicolon for `de-DE`. A decimal comma and a comma separator
  cannot coexist in one file, so a reader on the English interface who has chosen
  German numbers gets semicolons too.
- **A byte-order mark leads the file**, because Excel decides encoding from the
  first bytes and would otherwise render umlauts in product and supplier names as
  mojibake.
- **Lines end CRLF.**

The export is the record while the table is the view. A download reflects the
sort the reader is looking at and the filter they applied, and it carries the
data rather than the table's presentation - the profit export omits the deleted
marker its column renders, because that glyph is a cue on screen and not a value
in a spreadsheet.

## Client-side state and storage

There is no global store. Cross-cutting state lives in root-provided services
that expose signals; component state lives in the component.

Five keys are written to `localStorage`, each declared as an exported constant
beside the service that owns it:

| Key                       | Holds                              | Owner |
|---------------------------|------------------------------------|-------|
| `stockease.token`         | The session JWT                    | `AuthService` |
| `stockease.lang`          | Interface language                 | `LanguageService` |
| `stockease.theme`         | Light or dark                      | `ThemeService` |
| `stockease.format.date`   | Date format preference             | `FormatService` |
| `stockease.format.number` | Number format preference           | `FormatService` |

The four preferences follow one rule: a stored value this build does not
recognise is ignored rather than overwritten, because it is the reader's choice
and not this build's to discard. Every read and write is wrapped, so private
browsing or disabled storage degrades to an in-memory choice rather than an
exception. Preferences live in the browser rather than on the server by decision
(ADR 030).

The token is the exception in kind, not in mechanism. Keeping a bearer JWT in
`localStorage` is a decision with a written threat model and an accepted set of
risks - recorded in ADR 036, which supersedes ADR 013 and states what a
deployment holding real data would change.

[Back to Introduction and Goals](index.md)
