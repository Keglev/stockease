# Module: report

Read-only reporting as a CQRS-lite read model (ADR 006): native SQL
aggregations with zero Java dependencies on other modules.

## Exposed API

`ReportingService` and its own result records: `ProductProfitReport`,
`SupplierProfitReport`, `StockStatusReport`, `LossReport`,
`InvoiceDueSummary`, `DueDateBucket`. Cross-module vocabulary (invoice types)
travels as strings.

## Internals

None - the service queries via JdbcClient and owns no state.

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
