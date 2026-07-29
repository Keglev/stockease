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

ADR 005 is reserved for the demo-access design and will be written with the
demo-mode phase.

[Back to Documentation Home](/stockease/)
