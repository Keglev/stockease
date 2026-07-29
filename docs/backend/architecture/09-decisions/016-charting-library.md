# ADR 016: Direct ECharts, Not an Angular Wrapper

**Status**: Accepted
**Date**: July 28, 2026

---

## Context

The dashboard and the reports page need bar, line, area, pie and gauge charts
(PR #85, PR #86). Angular has established wrapper libraries for the common
charting engines, and reaching for one is the default move.

## Decision

**Apache ECharts, imported directly through `echarts/core`**, with every chart
type and component registered explicitly, and the whole integration wrapped
once in a component this repository owns.

The modular entry point ships nothing by default, so the registration list is
also the bundle contents - only the pieces the application draws are included,
and a chart using an unregistered type fails to compile rather than rendering
blank. ECharts itself is framework-agnostic and declares no Angular or
TypeScript peer dependency, so it cannot become the package that blocks an
Angular upgrade.

**The `init` function is provided through an injection token** rather than
called through the module import.

## Alternatives considered

**`ngx-echarts` or `ng2-charts`.** Rejected: both declare Angular and
TypeScript peer ranges, which is precisely the coupling that already produced
the TypeScript 6 conflict recorded in ADR 014 - a wrapper decides which
framework version the project is allowed to run. What they provide over the
engine is a component template and an options input, which is the wrapper
below and is roughly one file.

**Chart.js.** Rejected on the requirement: no native gauge, and the dashboard
needs one.

## Consequences

- The wrapper component is the entire integration surface. No feature
  component imports echarts; the wrapper owns instance lifecycle - init,
  option updates, resize and dispose - and the theme rebuild.
- Any new chart type must be added to the registration list, which is the
  point: bundle growth is an explicit edit.
- The injection seam exists for a concrete reason. Mocking the echarts entry
  point at module level proved racy: spec files sharing a Vitest worker share
  its module registry, so a spec that transitively imported the wrapper first
  left the real module resolved and the mock silently inert, at which point
  real echarts reached jsdom and died inside zrender. Injecting the engine
  makes the stub a provider, which is per-TestBed and cannot race. The fix
  landed with PR #86.

[Back to Decisions Index](index.md)
