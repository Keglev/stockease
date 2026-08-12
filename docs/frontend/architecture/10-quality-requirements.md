# Quality Requirements

Quality goals from the [introduction](index.md), made concrete and checkable.
The frontend's are enforced almost entirely by one suite and two gates.

## The runner

Vitest runs through Angular's `unit-test` builder against jsdom. The distinction
matters: the chain is `ng test`, not `vitest`. The builder compiles the
application the way the production build does, so a spec exercises components
through the real Angular compiler rather than a separately configured one, and a
template error is a test failure rather than something the runner never sees.
Invoking the raw runner would skip that compilation and test a different thing.

CI runs a single command, `npm run test:coverage`, which is `ng test
--watch=false --coverage`. Coverage is produced in the same pass rather than a
second one, so the reported numbers belong to the run that just passed.
`--watch=false` is the non-interactive mode; the watch-mode `npm test` passes no
`--coverage` flag, which is what keeps the thresholds inert during development.

## The coverage gate

`angular.json` declares four thresholds:

| Metric     | Floor |
|------------|-------|
| Statements | 90    |
| Branches   | 85    |
| Functions  | 85    |
| Lines      | 90    |

They are regression floors, deliberately set below what the suite achieves rather
than at it. Gating at the achieved number would fail any honest refactor that
moves a few lines; these trip only when coverage has genuinely fallen away. They
are global rather than per-file - a per-file gate fails on the first small file
with one uncovered guard, which is a different question from whether the suite
regressed.

The published coverage report is linked in the sidebar and is uploaded by every
run, pull requests included.

## What the suite tests, and how

**Dependency-injection seams, not module mocks.** A spec provides a stub for the
real token and lets Angular wire it. This is possible because the pieces are
shaped for it: `core/` services are ordinary root-provided classes, the two
signal stores are factories that take a `fetch` or a `close` callback rather than
a service, and the CSV downloader is an injection token. The seams substituted
most often are the feature services, `NotificationService`, `HealthService`,
`AuthService`, `MatDialog` and `MatDialogRef`, `BreakpointObserver` for
viewport-dependent behaviour, and `ThemeService` and `TranslateService` where
rendering depends on them.

**Component specs render.** They assert on what the real template produces -
that a row appears per product, that an admin sees a create button and a
non-admin does not, that a German reader sees German currency and not en-US -
rather than on component fields. The rendered output is the contract; the fields
behind it are not.

**A shell spec plus tab siblings**, where a page is large enough to need it. The
reports area is the example: `reports-page.component.spec.ts` owns what belongs
to the page rather than to any one tab - tab selection and first-activation
loading, what a refresh refetches, the single loading bar and single error banner
every tab reports through, and the chart context rebuilding on a language change.
Each tab's own rendering, filters, sorting and exports live in a sibling named
for it, seven of them, sharing one fixtures module. The whole-page fetch-timing
contracts stay in the shell spec permanently, because each asserts on the page's
entire call list rather than on one tab's.

## Test isolation

**Every spec file owns its start state.** This is an operational rule, not a
style preference, and the reason is specific: the browser-storage services
resolve their state at construction. `LanguageService` reads its stored key ahead
of the browser language, and `ThemeService` and `FormatService` do the same with
theirs. Spec files share a worker, so residue left by an earlier file changes
what a later one renders - and because Vitest orders files differently on
different machines, the resulting failure appears on one runner and not another,
on the same commit.

A global setup file, wired through the builder's `setupFiles` option, clears
storage before every spec file. A file's own `beforeEach` still runs after it, so
specs that deliberately seed storage are unaffected: they set their state after
the slate is wiped, which is the order they already assumed. That setup is a
safety net rather than the guarantee - a spec that depends on state it did not
set is still incorrect.

## Naming

Specs follow `method_state_expected`, verified by reading rather than assumed:

```
load_serviceReturnsProducts_rendersOneRowPerProduct
load_serviceErrors_rendersErrorMessage
render_adminRole_showsCreateButton
render_userRole_hidesCreateButton
priceCell_germanLanguage_rendersGermanCurrencyNotEnUs
delete_confirmed_callsServiceAndReloadsCurrentPage
```

The three parts are what is exercised, the condition, and the observable result.
Each spec file also opens with a plain block comment naming the contract it
covers and what is out of scope, and names its sibling files where a concern was
split away.

[Back to Introduction and Goals](index.md)
