# Architecture Decision Records

Decisions with justification: why a design was chosen, what alternatives were
rejected, and which trade-offs are accepted. ADRs are append-only; superseded
decisions are marked, never rewritten.

This is the system-wide decision log. The backend and frontend architecture
documentations reference it from their section 9 rather than keeping separate
logs, so one numbered sequence covers the whole system. Each entry is tagged
with the tier it decides for: **[Backend]**, **[Frontend]** or
**[Cross-cutting]**.

## Index

- [ADR 001 - Database Choice](001-database-choice.md) - **[Backend]**
- [ADR 002 - Validation Strategy](002-validation-strategy.md) - **[Backend]**
- [ADR 003 - Authentication Mechanism](003-authentication-mechanism.md) - **[Backend]**
- [ADR 004 - Inventory Domain Model](004-inventory-domain-model.md) - **[Backend]**
- [ADR 005 - Demo Access Without Credentials](005-demo-access.md) - **[Cross-cutting]**
- [ADR 006 - Audit and Profit Model](006-audit-and-profit-model.md) - **[Backend]**
- [ADR 007 - Modular Monolith with Spring Modulith](007-modular-monolith.md) - **[Backend]**
- [ADR 008 - Documentation Structure](008-documentation-structure.md) - **[Cross-cutting]**
- [ADR 009 - Sales Invoices and Customers](009-sales-invoices-and-customers.md) - **[Backend]**
- [ADR 010 - Pooled Inventory - No Lot Tracking](010-no-lot-tracking.md) - **[Backend]**
- [ADR 011 - Merchandise Scope and the Payment Fact](011-merchandise-scope-and-payment.md) - **[Backend]**
- [ADR 012 - Frontend Hosting on a CDN, Not a Container](012-frontend-hosting.md) - **[Frontend]**
- [ADR 013 - JWT in localStorage, No Refresh Token](013-token-storage.md) - **[Frontend]**
- [ADR 014 - Types-Only Generation from the OpenAPI Spec](014-openapi-types-only.md) - **[Cross-cutting]**
- [ADR 015 - Runtime Translation over Compile-Time Localization](015-runtime-i18n.md) - **[Frontend]**
- [ADR 016 - Direct ECharts, Not an Angular Wrapper](016-charting-library.md) - **[Frontend]**
- [ADR 017 - Central Decision Log at the System Level](017-central-decision-log.md) - **[Cross-cutting]**
- [ADR 018 - Product Creation is Master-Data Maintenance](018-product-master-data.md) - **[Cross-cutting]**
- [ADR 019 - The Purchase Price Follows the Last Closed Purchase](019-last-purchase-price.md) - **[Backend]**
- [ADR 020 - Losses Carry a Remark from a Fixed Taxonomy](020-loss-remark.md) - **[Cross-cutting]**
- [ADR 021 - Stock Enters Only Through Closed Purchase Invoices](021-stock-only-via-invoices.md) - **[Cross-cutting]**
- [ADR 022 - Invoice Numbers Are Operator-Assigned](022-invoice-numbers.md) - **[Cross-cutting]**
- [ADR 023 - Client-Side Chart Aggregation and CSV Export Conventions](023-chart-aggregation-and-csv.md) - **[Frontend]**
- [ADR 024 - Gross Profit as Cost of Goods Sold, Captured at Sale](024-profit-cogs.md) - **[Cross-cutting]**

[Back to Documentation Home](/stockease/)
