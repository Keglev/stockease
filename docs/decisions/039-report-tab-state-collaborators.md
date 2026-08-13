# ADR 039: Per-Tab State Collaborators for the Reports Page

**Scope**: [Frontend]
**Status**: Accepted
**Date**: August 13, 2026

---

## Context

`reports-page.component.ts` is 834 code lines against a page band of 60-140 with an
alarm at 180. It is the largest file in the frontend by a wide margin, and the number
is not the problem so much as what produces it.

The page renders seven tabs - profit, cash flow, stock, losses, due dates, changes,
analytics - and holds the whole state machine of each. It carries eight `load*`
methods, one per tab plus a second for the cash-flow product scope, behind a `loadTab`
switch that dispatches on the active index; six exporters, one per tab that offers a
CSV; and 54 signals and computeds, 34 stored and 20 derived. Seven services are
injected, and no tab needs more than a few of them: the audit client exists for the
changes tab alone, the dialog for one confirmation, the supplier client for two
typeaheads.

The members cluster by tab prefix rather than by kind. Ten `cashFlow*` members, six
`stock*`, six `analytics*`, five `profit*`, and so on down to the two `due*` ones -
each cluster a small state machine of rows, loading flag, period, sort, view toggle and
chart option, sharing nothing with its neighbours but the file they are declared in.
Reading any one tab means skipping past six others.

The card extraction of #219-#228 already took the presentation out. Each tab now
renders through its own card component, and those cards are within band. What the
extraction could not move was state: a card is presentational by the standard's own
division of labour, so the loaders, the derivations and the exporters stayed on the
shell. The page is smaller than it was and still eight times its band.

This is why the waiver route does not apply here. A waiver is granted where a file's
length is one rule working - `GlobalExceptionHandler` is long because status mapping is
concentrated there by design, and `report.service.spec.ts` is long because one case per
endpoint read is the spec working. Neither describes this page. It has eight reasons to
change, not one: any of the seven tabs can change independently, and the chart
rendering context is an eighth. A file with eight change-reasons is the case the split
criteria exist for, and calling it cohesive would be using the register to record a
decision not to look.

## Decision

**One `@Injectable()` state collaborator per report tab, provided by the page
component.**

Each collaborator owns exactly one tab's state machine: its signals, its loader, its
setters, its export, and the derivation of its chart option. It is listed in the
component's `providers` array, so it is created with the page and dies with it - the
same lifetime the state has today, reached through the injector instead of through
`this`.

**One shared `ReportChartContext` collaborator, also component-provided.** Every tab's
chart derivation reads the same base rendering context - the formatters, the palette,
the shared labels - widened on this page with the series and legend vocabulary only its
charts use. That widening is genuinely shared between tabs and is not any one tab's
property, so it becomes a collaborator the tab collaborators inject rather than a
member each of them copies.

**The page keeps what is actually the page's.** Tab activation and the dispatch that
loads a tab on first reach, the refresh that re-reads whatever is open, the error and
loading surface the tabs share, and any plumbing that genuinely spans tabs. What
remains is a shell, which is what the band describes.

This is not a new pattern in this codebase. `invoice-detail.component.ts` declares
`providers: [InvoiceDetailActions, InvoiceDetailReturns]`, and
`product-list.component.ts` declares `providers: [ProductRecycleBin]` - both
`@Injectable()` collaborators owning one flow of their page, both component-scoped,
both reached through the component in their specs rather than constructed. The seam is
already proven twice.

It is also the seam the tests already found. The reports-page spec suite is eight
files - a shell spec plus one per tab - split that way because each tab's cases only
ever touch that tab's state. The specs were divided along a boundary the component
itself does not yet express. This decision makes the component agree with them.

## Alternatives rejected

**Feature-level signal stores.** Move each tab's state into a store under the reports
feature, injected at the route or root level. This is the more conventional answer and
it is architecturally clean, but it is novel here: this codebase has signal stores in
its size bands and none of this shape, and the pattern would arrive on its largest,
most intricate page. It also changes semantics that currently come free. State provided
by the component is created when the page opens and discarded when it closes, so
navigating away and back gives a reader a fresh page. A store outside component scope
outlives the page, which means deciding what survives navigation, what a refresh
invalidates, and when a stale tab is re-read - real questions with real answers, none
of which the user would see. Rejected as a larger change with a wider blast radius and
no user-visible gain over a pattern already in use.

**Extract only the two heaviest tabs.** Cash flow and analytics carry the most members
between them, and lifting just those two is the smallest change that meaningfully moves
the number. Rejected because it does not finish. The page would still hold five tabs'
worth of state and remain far above alarm, and the residue would then need a waiver -
one that would have to argue cohesion for a file whose two most cohesive parts had
just been removed for not being cohesive with it. It also leaves the codebase with two
tabs on one pattern and five on another, which is worse to read than either pattern
applied consistently.

**Status quo with a waiver.** Record the length as accepted and move on. Rejected on
the register's own terms, stated above: a waiver says the length is one rule working,
and this length is eight responsibilities sharing a file. Granting it would spend the
register's credibility - every future reader would have to check whether an entry meant
"cohesive" or "we stopped here" - and it would leave the page's real cost in place,
which is not the line count but that no tab can be read, changed or reasoned about
without the other six in view.

## Consequences

The work is three code pull requests, sequenced so the pattern is proven before it is
repeated.

The first introduces `ReportChartContext` and converts two tabs, which is enough to
show the collaborator boundary holds against a real derivation and a real export before
five more are written against it. The second converts the middle group - losses, due
dates and changes - which are structurally alike and carry the least risk. The third
takes cash flow and analytics last, because they are the heaviest and because analytics
carries the product-picker coupling, which is the one piece of cross-tab plumbing whose
ownership has to be decided rather than moved.

Throughout, the reports-page spec suite stays green with zero assertion changes. That
is the check that the work is a reorganisation and not a redesign: the collaborators
are internal, they are driven through the same page the specs already render, and a
case that asserts what a tab shows after a period change cannot tell whether the signal
it read lives on the component or on a collaborator the component provides. Where a
template binding moves from `profitRows()` to something like `profit.rows()`, the
spelling changes and the behaviour does not.

The page's own file lands within, or close to, its band, and each collaborator is
measured against the service band it now belongs to. Should any land above its alarm,
that is reported as a finding rather than absorbed - this decision is a reason to
reorganise, not a licence to stop measuring.

[Back to Decisions Index](index.md)
