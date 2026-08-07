# Module: report

Read-only reporting as a CQRS-lite read model (ADR 006): native SQL
aggregations with zero Java dependencies on other modules.

## Exposed API

Four services, one per report family:

- `ProfitReportingService` - gross profit per product and per supplier, on a
  cost-of-goods-sold basis.
- `CashFlowReportingService` - money in and out on a payment basis, grouped by
  product or by calendar month.
- `StockReportingService` - one product's history, every product's current
  position, and the units written off.
- `CounterpartyReportingService` - what is owed and when, plus what a single
  customer bought or a single supplier sold.

Each exposes its own result records: `ProductProfitReport`,
`SupplierProfitReport`, `StockStatusReport`, `LossReport`,
`InvoiceDueSummary`, `DueDateBucket`. Cross-module vocabulary (invoice types)
travels as strings.

The controller injects all four directly - there is no facade over them (D1).

## Internals

None - the services query via JdbcClient and own no state.

## Invariants

- The documented exemption from the domain model: read-only, bounded,
  ADR-recorded.
- Historical reports include soft-deleted products (native SQL bypasses the
  soft-delete restriction naturally); current-state reports filter them
  explicitly.
- Supplier profit double-counts multi-supplier products by design, pinned by
  test.
- Loss lines are valued at current purchase price - a documented
  approximation.

[Back to Domain Modules](index.md)
