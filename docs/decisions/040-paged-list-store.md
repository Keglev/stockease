# ADR 040: Two List Stores, One for In-Memory Paging and One for Server Paging

**Scope**: [Frontend]
**Status**: Accepted
**Date**: August 17, 2026

---

## Context

Four pages in this app are registers: a table, a paginator, a progress bar and an error
banner over a list of records. They divide cleanly in two, and the line between them is
where their rows come from.

The customer and supplier registers fetch their register whole and page over it in
memory. They already share `createListPageStore`, which holds the rows, computes
`visibleRows` as a slice, and clamps the page index after a load so that deleting the
last row of the last page does not strand the table on a page that is no longer there.

The product catalogue and the invoice ledger ask the server for one page at a time.
Each carried its own `rows`, `totalElements`, `pageIndex`, `pageSize`, `loading` and
`error`, its own `onPage` that set the index and size and then reloaded, and its own
`load` that called its paged endpoint and, on failure, emptied the rows and reset the
total. Two pages, the same six signals and the same two methods, written twice.

The obvious move - point the two paged pages at the store the other two already share -
is the one the existing store's own documentation argues against. It states that its
paging is client-side by design, that these registers are bounded master data whose
pages cost a round trip to fetch and nothing to slice, and it names the invoice ledger
as the case where server-side paging earns its cost and therefore does not use it. That
reasoning is still right. What it left open was what the ledger should use instead, and
the answer until now was "its own copy of everything".

## Decision

**A sibling store, `createPagedListStore`, alongside the existing one rather than one
store with a mode.**

The two differ in what their central method does. `onPage` on the in-memory store
records the new index and size and lets a computed recompute a slice the page already
holds; `onPage` here records them and goes back to the server, because the rows for the
new page are not in hand. That is not a branch inside one method - it is the method.

They also differ in what the paginator's `length` means. On the in-memory store it is
the number of rows the client holds, and the store can count it. Here it is the server's
count of the whole result, which arrives on the response and cannot be derived from
anything the client has. So the paged store exposes `totalElements` and the in-memory
one has no such member.

**`loading` and `error` are writable here, and stay readonly there.** On the paged
pages these two signals are the page's single progress bar and single error banner, and
work other than a page load writes to them. The invoice ledger's CSV export puts its
failure in the same banner rather than introducing a notification channel the page does
not otherwise have. The product catalogue hands both signals to a page-level
collaborator, whose host interface declares them writable. Exposing them readonly would
not make those pages simpler; it would make each of them keep a second flag and a second
banner for the same two states, and then decide which of the two the template should
believe. The in-memory store has no such callers, so its readonly exposure is correct
for its own case and does not change.

**Page-index clamping is deliberately out of scope.** The in-memory store clamps after
a load because it can: it holds every row, so it knows the last page the moment the
rows arrive. The paged store cannot answer the same question the same way. It learns
the total from the response to a request it has already made, so an out-of-range page
has already cost a round trip by the time the store could react, and the reaction would
be a second request rather than an adjustment to a slice. Whether the right behaviour
is to refetch the last page, to show the empty page the server returned, or to prevent
the request from being made at all is a question about server round trips, and none of
the pages has yet met the case in practice. Recording it as unanswered is more honest
than porting the sibling's clamp and calling the difference an oversight.

The `fetch` the store takes is a function, not a service, matching the sibling's reason:
the store stays free of any one feature's API and can be given a stub in a spec. Its
response type is structural - `content` and `totalElements` - rather than a named API
model, because every paged endpoint in this app answers with that shape and naming the
models would tie the shared store to the features that use it.

## Alternatives rejected

**One store with a client/server flag.** A single factory taking a mode, branching in
`onPage` and in how it derives the paginator's length. Rejected because the flag would
not simplify a caller: every page knows which kind it is at the moment it constructs the
store, so the branch is decided at construction and never varies afterwards. What the
flag buys is one import instead of two; what it costs is that both behaviours live in
one body, every reader has to work out which half applies to the page in front of them,
and the members that exist in only one mode - `visibleRows`, `totalElements` - either
appear on both or need a union type to keep honest.

**Extend the existing store to cover both.** Add `totalElements` and a refetching path
to `createListPageStore`. Rejected for the same reason as the flag, with an additional
cost: it changes a store two shipped pages already depend on, so the blast radius covers
four pages instead of two, and it would contradict that store's own documented argument
for staying in memory.

**Leave the duplication.** Two pages, six signals and two methods each. Rejected because
the duplication is not incidental - the two copies had already drifted in a way that
mattered. Both reset the rows on a failed load; the invoice ledger also reset
`totalElements`, so its paginator stopped offering pages that had nothing behind them,
and the product catalogue did not. That is the class of divergence a shared store
prevents, and finding it is what made the case for extraction concrete rather than
tidy-minded.

## Consequences

The invoice ledger migrates in the pull request that introduces the store, which is what
proves the store against a real page. Its whole load path already did what the store
does, including the total reset on failure, so the migration changes no behaviour and
its spec suite passes with every assertion untouched. The only spec edits are the two
places that reach `onPage` by name on the component instance and now reach it through
the store member, which is the same access-path change ADR 039 describes and the same
invariant: what a case asserts does not move.

The product catalogue is deliberately not migrated in that pull request. It carries a
page-level collaborator that holds its own references to `loading` and `error`, so its
migration has a question to answer that the ledger's did not, and answering it under the
same change that introduces the store would make a failure ambiguous between the two.
Until it migrates, the catalogue keeps its own copy of the six members, and the
duplication this record exists to remove is half removed - which is visible, and
preferable to a migration whose failures could not be attributed.

`DEFAULT_PAGE_SIZE` moves into the store, so the two pages stop declaring their own copy
of the same constant.

[Back to Decisions Index](index.md)
