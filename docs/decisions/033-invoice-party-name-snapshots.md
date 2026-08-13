# ADR 033: Invoice Documents Snapshot Their Party Names

**Scope**: [Cross-cutting]
**Status**: Accepted
**Date**: August 5, 2026

---

## Context

An invoice is a document. It states who it was issued by or to, and what was
bought, as those things stood on the day it was issued. Until now this
application stored none of that: the invoice held foreign keys, and every
display read the name through the JPA association at render time. The name a
document showed was therefore master data, not document content.

`Supplier`, `Customer` and `Product` all carry `@SQLDelete` with
`@SQLRestriction("deleted_at IS NULL")`, and deletion of a party with only
settled history is allowed - `OpenInvoiceDeletionVeto` blocks the deletion only
while an **OPEN** invoice references it. So the two facts collide by design: a
supplier with nothing but paid invoices can be deleted, and every one of those
invoices then reads its counterparty through a row the restriction hides.

A measurement pass built the three scenarios through production paths - create,
close, pay, delete the party - and recorded what each surface then did. Four
distinct failure classes came out of it:

- **Wrong data.** `GET /api/invoices/{id}` answered 200 with
  `supplierId: null, supplierName: null`. The frontend detail page renders
  `supplierName ?? customerName ?? 'invoices.walkIn'`, so a settled **purchase
  invoice from a named supplier displayed as "Walk-in sale"**. Not a blank - a
  different, false statement about the document. The id was nulled alongside the
  name, so nothing on the response could be used to recover it.
- **500.** With a soft-deleted product on a line, the same endpoint returned
  `{"success":false,"message":"An unexpected error occurred..."}`. The invoice
  became unreadable outright.
- **Conditional crash.** In a persistence context that had already loaded the
  invoice through the list query, the supplier proxy exists but cannot
  initialize: `EntityNotFoundException: No row with the given identifier exists`,
  raised from `InvoiceSummaryResponse.from`. Whether a request hit the null case
  or this one depended on what it had touched first.
- **List fallback.** The list keeps `supplierId` (reading an identifier off a
  proxy does not initialize it), but the frontend resolves names client-side
  against `suppliers.getAll()` - a live-only list - so a deleted party's row
  renders `#7`.

The mechanism behind the split is join-column optionality, not fetch strategy.
`@SQLRestriction` **is** applied to a `left join fetch`. For the optional
`Invoice.supplier` and `Invoice.customer`, Hibernate finds no row and resolves
the association to `null`, silently, discarding the foreign key with it. For
`InvoiceItem.product`, which is `@JoinColumn(nullable = false)`, the same missing
row is an error: `FetchNotFoundException`, translated to a 500.

## Decision

**Invoices snapshot their party names at issuance, and invoice reads never
consult the party tables.**

Four parts, all backend:

1. **Snapshot columns** (`V22`). `invoice.supplier_name`, `invoice.customer_name`
   nullable; `invoice_item.product_name` NOT NULL. Backfilled by plain
   `UPDATE ... FROM` on the foreign key. The backfill is deliberately **not**
   filtered on `deleted_at`: native SQL does not see `@SQLRestriction`, so
   parties deleted before the migration still hand over their names - which is
   precisely the population this change exists for.

2. **Written once, at creation.** The snapshot is taken in `createInvoice`, at
   the moment the party is resolved, and there is no update path afterwards.
   Renaming a supplier does not rewrite the invoices already issued to it. This
   is the same rule the line's `unit_price` has always followed.

3. **Reads are de-joined.** `findDetailById` fetch-joins the items collection
   and nothing else; the supplier, customer and product joins are gone. Names
   come from the snapshot columns and identifiers from read-only foreign-key
   scalars (`@Column(insertable = false, updatable = false)`) mapped alongside
   the associations, which is what preserves the id when the joined row is
   hidden. No invoice web mapping touches `getSupplier()`, `getCustomer()` or
   `getProduct()` any more.

4. **Two guards keep the invariants honest.** A return whose product is
   soft-deleted is refused with 409 and a message naming the product and the
   remedy; a product with non-zero stock cannot be deleted at all, also 409.

The summary DTO additionally carries `supplierName` and `customerName`. This is
additive on the wire, and the frontend list continues to resolve names
client-side until a following change consumes them - so the list keeps its `#7`
fallback for one release while the detail page is correct immediately.

## Consequences

An invoice now reads identically whether its parties are live, renamed or
deleted, and the read path cannot be broken by master-data state at all: there
is no join left to hide a row from. Deleting a supplier with settled history
stays allowed, which was the point - the guarantee is about display, not about
restricting deletion further.

The cost is duplication. A name lives in two places, and the copy on the invoice
will drift from the master row the moment someone corrects a typo. That is the
intended behaviour for a document and a bug for anything else, so the snapshot
columns must never be joined back to, refreshed, or offered as a search index.

Returns now require a live product. The operator path for a warranty return
against a deleted product is **Restore, book the return, delete again** - three
steps, each of which is an existing, audited operation.

## Alternatives rejected

**Native-SQL invoice reads.** The reporting module already reads party names in
native SQL, which bypasses `@SQLRestriction` and renders deleted parties
correctly today. Rewriting the invoice reads the same way would have fixed the
500 and the nulls with no schema change. Rejected: it keeps the displayed name
hostage to master data. A supplier rename would retroactively change what every
historical invoice says it was issued by, which is wrong for a document
regardless of whether the row is live. It also leaves the immutability rule
unexpressed anywhere in the schema.

**`@NotFound(action = NotFoundAction.IGNORE)` on the associations.** Makes
Hibernate resolve a missing target to `null` instead of throwing, which would
have closed the 500. Rejected on three counts, one of them measured: it forces
the association to be fetched eagerly, defeating the laziness the list
deliberately relies on; it still provides no name, so the "Walk-in sale" wrong
data would have survived untouched; and its semantics already vary between the
optional and non-optional mappings here, which is the variability that produced
two different failure modes from one cause.

**A warranty window: allow returns against deleted products for N days after the
sale.** Superficially the kindest option, and rejected as unworkable. An
accepted return creates stock, and stock on a deleted product is displayed by no
surface in the application - so the design forces a second decision immediately:
auto-restore the product (silently undoing an administrative act), or invent a
third product state between live and deleted. The "but the stock left again via
a supplier return" exception cannot be settled from movement data, since nothing
records that an inbound customer return and a later outbound supplier return are
the same units. And the window length is shop policy rather than law - German
practice alone spans the 14-day *Widerruf* and the 24-month *Gewährleistung* -
so any constant would be this application inventing a rule its operators did not
choose. Accepting a late return is a judgement call, and the manual path lets
the operator make it explicitly, while the live-stock invariant holds absolutely.

Supplier restore symmetry - a recycle bin for suppliers and customers, matching
the one products already have - is a natural extension and is deliberately left
for later; nothing here depends on it.

[Back to Decisions Index](index.md)
