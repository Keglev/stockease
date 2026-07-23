# Cross-cutting Concepts

Recurring mechanisms that hold across modules. Each concept links to the
decision record carrying its full rationale.

## In-process application events

Cross-module reactions use Spring application events, not a broker
(ADR 007). Two flavors, chosen per flow:

- **Synchronous listeners** where atomicity matters: the invoice-close
  listener books stock inside the closing transaction; the audit listener
  writes the change log in the same transaction as the change. Commit or
  roll back together - never half.
- **Deletion vetoes**: listeners pinned to run before all other listeners
  that throw inside the deleting transaction while open invoices pin a
  supplier or product. Spring defines no default order between listeners on
  one event, so veto precedence is explicit, making fail-fast deterministic.

Event payloads never import the consuming module's types; shared vocabulary
is mirrored by name and mapped on arrival - the price of an acyclic module
graph.

A standing rule follows from a found bug: every event-listener change ships
an integration test through the real event pipeline. Mocked publishers are
structurally blind to persistence-context effects (a deleted-then-referenced
entity broke only in the real pipeline).

## The single quantity write path

All stock changes flow through one service method holding a
PESSIMISTIC_WRITE lock; negative stock is rejected with no override
(ADR 004). Concurrent closes serialize on the product row instead of racing.

## Derived versus stored

Snapshots are stored; conclusions are derived. Movements store the price
copied from their invoice item at booking time - a historical fact that must
survive later price changes. Totals, overdue status and profit are computed
at read time - deriving them keeps them incapable of going stale (ADR 011).

## Soft delete, partial indexes, restore

Deletable master data (product, supplier, customer) stamps `deletedAt`
rather than removing rows, keeping history joinable. Uniqueness (product
name, SKU, customer email) is enforced by partial indexes over live rows
only, so deleted names are reusable. Restore revives a soft-deleted product
unless a live row took its name or SKU meanwhile. Implementation detail with
a lesson behind it: soft delete stamps-and-saves instead of calling a
repository delete, so same-transaction listeners keep a valid entity
reference.

Native-SQL reporting bypasses the soft-delete restriction by nature - a
feature for historical reports, an explicit filter for current-state ones
(ADR 006).

## Schema ownership

Flyway owns the schema; Hibernate only validates (`ddl-auto=validate`).
Applied migrations are immutable - new concerns get new migration files.
Exact DDL (numeric precision, partial unique indexes) exists only because
no generator ever rewrites it.

## Comment and test discipline

Class documentation states purpose in two sentences; inline comments explain
why, never what. Tests are named method_state_expected and capped in length;
committed fixtures use globally unique names so suites compose.

[Back to Architecture Index](index.md)
