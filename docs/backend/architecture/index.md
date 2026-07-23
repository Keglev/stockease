# Introduction and Goals

StockEase demonstrates production-grade backend engineering on a realistic
merchandise-management domain. It is a portfolio project built to the standards
of a commercial codebase: enforced module boundaries, migration-owned schema,
an append-only booking model and a test suite that proves the invariants.

## Requirements overview

The system manages the merchandise cycle of a small trading business:
product master data, suppliers and customers, purchase and sales invoices
(every sale is invoiced, following German practice), stock movements derived
from invoice lifecycle events, a change audit trail and read-only reporting.

## Quality goals

1. **Correctness of stock arithmetic.** A single, locked quantity write path;
   negative stock is impossible by construction.
2. **Verifiable boundaries.** Module dependencies are architecture law,
   enforced by Spring Modulith and a boundary test on every build.
3. **Auditability.** Who changed what, when: product changes, invoice
   lifecycle stamps and movement records are append-only facts.

## Stakeholders

A solo developer building for technical reviewers: recruiters and engineers
assessing code quality, architecture reasoning and documentation practice for
the German market.

> **Status: skeleton.** The remaining arc42 sections are stubs that are being
> filled section by section; decision content already lives in the
> [ADR index](09-decisions/index.md).
