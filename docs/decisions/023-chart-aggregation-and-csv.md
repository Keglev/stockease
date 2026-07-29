# ADR 023: Client-Side Chart Aggregation and CSV Export Conventions

**Status**: Accepted
**Date**: July 29, 2026

---

## Context

The dashboard and the reports page were built against the seeded demo dataset,
which holds roughly ten products. Every categorical chart plots one entry per
product: the profit bar, the stock-value bar and the loss pie. At that size the
charts are readable, and the reports profit bar deliberately plotted *every*
product as the thing that distinguished the page from the dashboard's top ten.

A real inventory has hundreds of products. A three-hundred-row horizontal bar
chart is a grey block with unreadable axis labels, and a pie of three hundred
slices is a colour wheel. The distinction the reports page needs is not an
unabridged chart - it is the exhaustive table, which stays readable at any row
count because it scrolls.

The tables themselves raise a second question. Once a table carries hundreds of
rows, the reason to look at it is usually to take the figures somewhere else -
a spreadsheet, an email, an accountant.

## Decision

**Charts plot the ten largest entries by absolute value plus one aggregated
remainder bucket**, labelled "Other" / "Sonstige". The ranking uses the absolute
value because gross profit can be negative and a large loss is as chart-worthy
as a large gain. The bucket carries the plain sum of everything past the cut, so
it can itself be negative.

The aggregation is **computed client-side**, in one shared preparation module
(`shared/chart/chart-data.ts`), over the full report payload the endpoints
already return. It applies to the profit-by-product chart on both the dashboard
and the reports page, the stock-value chart, and the loss pie. The margin gauge
and the due-date chart are untouched: a gauge has no rows, and the due chart
aggregates by date rather than by product.

**CSV export is client-side too**, from the same rows the table displays, in the
displayed sort order. The field separator and the decimal separator follow the
UI language: German gets a semicolon and a comma decimal, English gets a comma
and a dot decimal. This is recorded here rather than left in the code because it
reads as a bug otherwise - German Excel opens a comma-separated file with dot
decimals as a single column, so the "wrong" separator is the correct one. Files
carry a UTF-8 byte order mark for the same reason: without it Excel renders
umlauts in product and supplier names as mojibake.

## Alternatives considered

**A backend top-N query parameter.** Rejected *for now*, and explicitly
deferred rather than dismissed. The report payloads are small, the frontend
needs the full row set anyway to render the tables and the CSV export, and a
server-side path would exist only for a dataset size the demo never reaches -
two code paths producing two definitions of "top ten". Revisit when a real
dataset makes the payload itself the bottleneck; at that point pagination of
the tables becomes the larger question and the chart parameter should be
decided together with it.

**Server-generated CSV.** Rejected: it adds an endpoint, a content-negotiation
concern and a second place where column sets and translations live, for a file
the browser can assemble from data it already holds in memory.

**A larger cut, or a per-chart cut.** Rejected: one shared constant is the
point. A chart-specific threshold is a number nobody can justify, and ten is the
count at which a horizontal bar chart's labels stop overlapping.

## Consequences

- The aggregation threshold is one shared constant (`CHART_TOP_N`). Changing
  what "top ten" means is one edit, and it moves every chart at once.
- The remainder bucket can carry a negative value. That is by design, not a
  defect: a bucket of loss-making products sums to a loss.
- The bucket label is translated at the moment the chart option is built, so a
  language switch relabels it on the next load rather than in place. Every
  chart option on both pages already behaves that way.
- Charts and tables now answer different questions. The chart is the shape of
  the distribution; the table is the record. This is what makes the reports
  page's chart/table toggle sensible rather than a space-saving trick.
- CSV files are locale-shaped. A file exported in German and one exported in
  English are not byte-identical, which is intended and is the reason the
  separator rule is documented here.

[Back to Decisions Index](index.md)
