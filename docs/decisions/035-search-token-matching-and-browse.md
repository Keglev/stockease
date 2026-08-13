# ADR 035: Search Matches Tokens, and an Empty Picker Browses

**Scope**: [Cross-cutting]
**Status**: Accepted
**Date**: August 6, 2026

---

## Context

ADR 028 replaced every full-list picker with a typeahead. The transfer problem
it set out to fix is fixed. What it left behind is a discovery problem, and two
findings a month of use made plain.

**The scoped picker reads as broken.** On the analytics and cash-flow tabs the
reader chooses a supplier, and the product field beneath it then sits empty and
says nothing. It is enabled, it has a label, and it renders no rows — because
the shared component sends nothing below three characters, and an untouched
field has none. A reader who has just named a supplier and wants to see what
that supplier sells is shown a blank box. The information is one query away and
the control refuses to ask for it. The catalogue-wide pickers on the movement
and invoice forms have the same silence, and it is more defensible there —
nobody expects a box to list an entire catalogue unprompted — but the scoped one
is a list of, typically, a handful of products, and there is no reason not to
show it.

**One substring against one field is a guessing game.** The match was a single
case-insensitive `LIKE` over the product *name*. Three consequences, all
reported:

- **Word order had to be guessed.** "Druckerpapier A4" is not found by "papier
  drucker", and a reader who remembers the two words but not their order has to
  try both.
- **The SKU was unsearchable.** It is printed on the shelf label, it is what a
  warehouse worker reads off a box, and typing it found nothing. The column was
  already on screen in every table; only the search ignored it.
- **The two product pickers answered differently in principle.** The
  catalogue-wide one and the supplier-scoped one both matched name-substring, so
  the divergence was latent rather than live — but nothing held them together
  except that both had been written the same week.

The blank-term question turned out to have an answer already. Measured on `main`
before this change: `LIKE '%%'` matches every row, so all three endpoints
*already* returned the first capped page alphabetically for an empty term. The
behaviour existed, was untested, and was unreachable from the client.

## Decision

**A term is tokens, and every token must match. A blank term matches
everything.**

**Token matching.** The term is split on whitespace. Every token must match,
case-insensitively, as a substring of at least one of the searched fields.
Tokens may arrive in any order, so "dru pap" and "pap dru" both find
"Druckerpapier A4". The conjunction is the point: each word is something the
caller meant, so one word that matches nothing means the term matches nothing.

**Which fields, per endpoint:**

| Endpoint | Fields a token may match |
| --- | --- |
| `GET /api/products/search` | name **or** SKU |
| `GET /api/reports/suppliers/{id}/products/search` | name **or** SKU |
| `GET /api/suppliers/search` | name only |

The two product searches match identically because a reader has no way to tell
which of them a given field on a page is wired to; if the scoped one refused a
SKU the catalogue-wide one accepted, that would read as a bug. A supplier gets
name only because it has no second identifier worth searching — its address is
not one, and a supplier picker that answered on street names would surprise.
Multi-token still applies to suppliers: two pickers on one screen must not
differ on whether word order matters.

**A token is matched against each field on its own**, never against the fields
concatenated. A fragment that exists only across the boundary between a name and
a SKU is not a match.

**Blank browses.** A blank or whitespace-only term is zero tokens, and zero
tokens is the empty conjunction: everything matches, and the endpoint answers
the first capped page alphabetically. Browsing stays scoped — an empty term on
the supplier-scoped search returns that supplier's products, never the whole
catalogue.

**The client browses on focus.** Focusing an empty typeahead fires the search
with an empty term immediately. The three-character minimum stays for *typed*
terms and is bypassed only for the empty case, which is a different question:
"what is there?" rather than "which of these did I mean?". This applies to every
typeahead instance, scoped and global alike, because it lives in the shared
component and no consumer opts out.

## Alternatives considered

**Full-text search — `tsvector`, or a trigram index.** Rejected as premature.
It would bring stemming, ranking and an index to maintain, and the complaint was
not that matching was imprecise; it was that it was too narrow to reach the row
the reader was looking at. `LIKE` under a twenty-row cap over demo-scale data is
not the bottleneck, and a ranking function would make the capped window harder
to reason about, not easier. If the catalogue ever outgrows this, the endpoints'
contract does not have to change to adopt it.

**Match the concatenated `name || ' ' || sku`.** Rejected, though it is one
predicate instead of two and Postgres would express it in a single `ILIKE ALL`.
It admits matches that straddle the boundary between the two fields, which are
coincidences rather than answers. Per-field matching costs one more `OR` and
means exactly what it says.

**OR across tokens instead of AND.** Rejected. Under a twenty-row cap, OR makes
every additional word *widen* the result — typing more would push the row the
reader wanted out of the capped window. Search should narrow as it is refined.

**Browse on focus for the scoped picker only.** Rejected, and it was tempting:
the scoped list is small and the catalogue-wide one is not. But both are capped
at twenty rows, so "the whole catalogue" is never what arrives — the first
twenty of it is, which is a browse either way. Two pickers that behave
differently on focus would be a rule the reader has to learn, in exchange for
nothing.

**Lower the minimum term length to one character instead.** Rejected. It
answers the wrong question: a one-character term is a bad *search*, matching
most of the table for no reason, while an empty field is not a search at all. The
two cases deserve different treatment, which is what bypassing the minimum for
the empty case alone gives them.

**Native SQL for the token predicate on products and suppliers.** Rejected, and
this one is a correctness matter rather than taste. Postgres would express
token-AND in one `ILIKE ALL`, but a native query bypasses `@SQLRestriction` — the
mapping-level filter that keeps soft-deleted rows out of every search in this
codebase — so each query would have to restate `deleted_at IS NULL` by hand. The
matching is built as a JPA `Specification` instead, which is a mapped query, so
the exclusion still applies and cannot be forgotten. The supplier-scoped search
stays native because it always was: it joins across the purchase ledger, which is
`ReportingService`'s sanctioned job, and it already states its soft-delete
predicates explicitly.

## Consequences

- **This partially supersedes ADR 028's matching rule.** 028's contract — 200
  with an empty array, alphabetical, capped at 20, soft-deleted rows excluded,
  the cap is not pagination — stands unchanged. Only the sentence describing the
  match as "a case-insensitive substring match" is replaced. 028's prose is left
  as written and carries a supersession note on its Status line.
- **The change only widens.** Every term that matched before still matches: a
  single token against a name is the query it always was. No caller can be
  broken by a result set that grew, though one that asserted on an exact list
  may now see more rows.
- **The three-character minimum is now a rule about typed terms.** It reads as
  an inconsistency in the client — a component that refuses to send "ab" but
  sends "" — and it is worth stating plainly that this is deliberate, because
  the next reader of `TypeaheadComponent` will otherwise "fix" it.
- **Blank-term behaviour became a contract.** It was already the behaviour;
  what changed is that it is documented and has tests. Anything that narrows it
  later — a guard that rejects empty terms as a bad request, say — is now a
  breaking change rather than a tidy-up.
- **A term with many tokens builds a wider predicate.** The supplier-scoped
  query appends one `AND` per token, and the two Specification-based searches
  build one disjunction per token. At demo scale this is invisible; at a scale
  where it is not, the fix is the index, not fewer tokens.
- **`SearchTerms` is shared across three modules.** One tokenizer, for the same
  reason `SearchLimits` is one constant: the three endpoints are presented to
  the reader as the same control, and a divergence in how they split a term
  would read as a bug.

---

---

*Amendment (2026-08-07): `ReportingService`, named above, was split into four
family services in #187 (ProfitReporting, CashFlowReporting, StockReporting,
CounterpartyReporting). The role described here now lives in
CounterpartyReportingService. The decision itself is unchanged.*

[Back to the Decision Log](index.md)
