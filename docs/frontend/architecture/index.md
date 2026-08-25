# Introduction and Goals

The StockEase frontend is the interface a warehouse or office user works in: it
turns the backend's merchandise domain into pages that can be operated without
knowing the API behind them. It is built to the same standard as the backend -
typed against the generated API contract, tested at every layer, and documented
with the reasoning kept next to the code.

## Requirements overview

The application covers the merchandise cycle from the operator's side: product
master data, supplier and customer registers, purchase and sales invoices with
their lifecycle, the stock movements those invoices produce, a change history
reachable from a product or an actor, a reporting area, and per-user settings
for language and theme. A public landing page and a help section sit alongside
it for readers arriving without an account.

## Quality goals

1. **The interface never invents domain truth.** Figures are rendered as the
   backend reports them. Where the client computes - chart aggregation, CSV
   export, report totals - it does so from loaded rows and nothing is written
   back.
2. **Both languages stay complete.** Runtime translation has no compiler
   checking a key exists, so a parity check over the shipped bundles enforces
   membership and ordering across English and German on every build, and a
   second check refuses a bundle that no longer matches its authored sources.
3. **Accessible and legible on any viewport.** Light and dark themes are built
   from Material system tokens rather than hardcoded colours, and the shell
   adapts its navigation to the breakpoint rather than presenting a desktop
   layout on a phone.

## Stakeholders

A solo developer building for technical reviewers: recruiters and engineers
assessing code quality, architecture reasoning and documentation practice for
the German market. The German interface is part of that argument, not a
translation added afterwards.

## Scope

This tree documents the browser application in `frontend/`: its composition,
its state, how it reaches the API and how it is built and tested. It does not
document the domain rules themselves - what an invoice may do, how stock
arithmetic is guarded, what the audit trail records - which are decided and
enforced on the server and described in the
[backend architecture](../../backend/architecture/index.md).

Decisions affecting both sides live in the single system-wide
[decision log](../../decisions/index.md) rather than in either tree.

This tree reuses the backend tree's section numbers where a section applies to
the frontend, and the gaps are deliberate: constraints, system context and the
glossary are system-level and are documented once, in the backend tree.

## Documentation map

- [Frontend architecture overview](overview.md) (English) -
  [Deutsche Fassung](overview-de.md)
- [Building Blocks](05-building-blocks.md)
- [Runtime View](06-runtime.md)
- [Deployment View](07-deployment.md)
- [Cross-cutting Concepts](08-concepts.md)
- [Quality Requirements](10-quality-requirements.md)
- [Decision log](../../decisions/index.md)

[Back to Documentation Home](/stockease/)
