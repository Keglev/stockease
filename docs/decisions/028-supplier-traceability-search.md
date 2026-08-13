# ADR 028: Search-First Navigation and Supplier-Scoped Product Discovery

**Scope**: [Cross-cutting]
**Status**: Accepted; partially superseded by ADR 035 (token matching, blank-term browse)
**Date**: August 3, 2026

---

## Context

Every picker in the application was a full list. The analytics tab opened by
fetching the entire product catalogue into a `mat-select` so a reader could
choose one row from it; the movement form does the same. At demo scale — a
couple of dozen products — this is invisible, and the code that does it carries
a comment saying as much: *"the full list at demo scale; the product search
endpoint is the path if a catalogue ever outgrows a select."*

The production review closed that escape hatch. Two things were wrong with the
pattern independently of scale:

- **It transfers a table to filter it.** A picker that must ship every row to
  offer one is not a picker that grows; it is one that has not been asked to
  yet.
- **It queries what nobody asked for.** Opening the analytics tab issued a
  catalogue fetch before the reader had named anything, and choosing a product
  immediately issued two more — a stock-history query and an audit query — so a
  reader browsing the dropdown fired a pair of reports per selection while
  looking for the one they meant.

Separately, **supplier traceability** had been a queued design since the
invoice module took shape: the ability to ask what a supplier has sold us, and
the ability to refuse to delete a supplier still named by live purchases. Both
halves rest on the same linkage, and neither had been built.

The two problems meet at one question. The useful way to find a product is
rarely "somewhere in the catalogue" — it is "the one I bought from that
supplier." Search-first navigation and supplier traceability are the same
feature approached from two directions.

## Decision

**Discovery is search-first, and product discovery follows the supply
relationship.**

Three pieces:

**Typeahead endpoints replace full-list transfers.** `GET
/api/suppliers/search?name=` and `GET
/api/reports/suppliers/{id}/products/search?name=` each answer a
case-insensitive substring match, alphabetical, capped at 20 rows
(`SearchLimits.TYPEAHEAD_LIMIT`), excluding soft-deleted rows. The cap is not
pagination: a term matching more than twenty rows is a term to narrow, which is
why the client requires three characters before it asks at all. Both are read
by one shared `TypeaheadComponent` that owns the minimum term length, a 300ms
debounce, and the `switchMap` that drops a superseded in-flight response — so
the four places this control appears cannot drift in any of those behaviours.

**A supplier's products are drawn through the purchase ledger.** There is no
supplier column on a product. A product is a supplier's because that supplier
was invoiced for it: `invoice_item` → `invoice(supplier_id, invoice_type =
'PURCHASE', deleted_at IS NULL)` → `product`, `DISTINCT`. Because stock enters
only through closed purchase invoices (ADR 021), every stocked product is
reachable this way, which is what makes the linkage a complete index rather
than a partial one.

**The scoped search lives in the reporting module.** `/api/reports/suppliers/{id}/products/search`
sits under the reports path, not the supplier path, because the aggregation is
the reporting module's: the query reads invoice data, which the supplier module
cannot see — Spring Modulith's `ApplicationModules.verify()` enforces that, and
`ReportingService` is the module that legitimately reads across tables with
native SQL. This is the customer-summary precedent applied exactly:
`/api/reports/customers/{id}/summary` describes a customer and lives here for
the same reason. **Module ownership decides the path; URL tidiness does not.**
The plain supplier name search stays in the supplier module, at
`/api/suppliers/search`, because it touches only that module's own table.

**Analytics fetches only when asked.** The tab now cascades — supplier, then
that supplier's products — and neither field triggers a report. An explicit
**Show** button is the only control that fetches the stock and price series.
Switching the picked product without pressing Show changes nothing on screen;
that is the gate, not a side effect of it. Period presets *do* refetch once a
product is shown, because asking for a product is a standing request: the
window is which slice of that product's history the reader wants, not a new
subject.

**The supplier is a navigation aid, not a query dimension.** Neither tab ever
sends it. On analytics the two series are one product's own history, which no
supplier narrows. On cash flow, the chosen product scopes the timeline through
a new optional `productId` parameter — reusing the existing shared SQL
fragments rather than forking the query, so a scoped month and that product's
row in the per-product sibling cannot disagree — while the supplier only
decides which products the second field can offer. Cash flow *by supplier*
would be a different report from the one that tab shows.

## Alternatives considered

**Client-side filtering over the full lists.** Rejected. It is the pattern
already in place with a text box in front of it: the catalogue still crosses
the wire in full, and the only thing that improves is the typing. It transfers
a table in order to filter it, which is precisely the objection.

**A combined free-text product search with no supplier scoping.** Rejected,
and this is the sharper of the two, because it is the cheaper build — the
product search endpoint already exists. The ruling is that discovery should
follow the supply relationship: "the widget I buy from Acme" is the question
operators actually have, and answering it with a catalogue-wide match returns
products from suppliers the reader was not asking about. Scoping is also what
makes the traceability linkage real code rather than a design note.

**Extend the existing `/api/products/search` with a supplier filter.**
Rejected. That endpoint lives in the product module, which cannot read invoice
data without breaking the module boundary; the supplier predicate would have to
be smuggled in through a cross-module dependency that `ModularityTest` would
reject.

**Auto-fetch on product selection, as before, but from the search.** Rejected.
It preserves the second half of the original complaint: a reader stepping
through suggestions would fire two reports per candidate. The explicit action
is the point.

## Consequences

- **The delete-veto half of supplier traceability remains deferred.** This
  slice ships the read half only. Refusing to soft-delete a supplier still
  named by live purchase invoices is the same linkage read in the other
  direction, and it belongs with the `OpenInvoiceDeletionVeto` precedent the
  invoice module already sets. It is named here so a future reader can see that
  the omission is scheduled rather than overlooked.
- **A product bought from two suppliers appears under both.** This is correct,
  not a duplicate to resolve: both suppliers really did sell it to us, and a
  reader searching under either one is asking a question the answer belongs to.
  Any future report that counts products per supplier must not treat these as
  distinct products.
- **The typeahead becomes the app's standard for large pickers.** The movement
  form's full-list product select is the obvious next adopter; it was left
  alone here to keep this slice to the tabs the ruling named.
- **New search surface diverges from `/api/products/search` on purpose.** The
  older endpoint answers **204 with a body** when nothing matches — a shape its
  own spec file annotates as "unconventional by HTTP spec" — and has no cap.
  The two new endpoints answer **200 with an empty array** and cap at 20, so a
  caller gets a list unconditionally and the client's "no matches" state is
  trivial. Correcting the older endpoint is tracked as its own backlog item;
  this inconsistency is a deliberate refusal to enshrine a known defect as a
  convention, in neither direction an accident.
- **The analytics tab fetches nothing on activation.** It is the first tab on
  the page that opens completely idle, which is a visible behaviour change: a
  reader who previously saw a populated dropdown now sees two empty search
  fields and a disabled button.
- **`SearchLimits` is shared across two modules.** One constant, because the
  two endpoints are presented to the user as a single cascading control and a
  divergence between their caps would read as a bug.

---

---

*Amendment (2026-08-07): `ReportingService`, named above, was split into four
family services in #187 (ProfitReporting, CashFlowReporting, StockReporting,
CounterpartyReporting). The role described here now lives in
CounterpartyReportingService. The decision itself is unchanged.*

[Back to the Decision Log](index.md)
