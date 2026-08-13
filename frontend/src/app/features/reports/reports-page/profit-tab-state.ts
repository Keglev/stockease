import { Injectable, computed, inject, signal } from '@angular/core';
import { Sort } from '@angular/material/sort';

import { ProductProfitReport, SupplierProfitReport } from '../../../core/api/api-models';
import { GaugeBand } from '../../../shared/chart/chart-context';
import { topNWithRemainder } from '../../../shared/chart/chart-data';
import { ChartFormat } from '../../../shared/chart/chart-format';
import { ChartOption } from '../../../shared/chart/chart.component';
import { CsvExportService } from '../../../shared/csv/csv-export.service';
import { ReportService } from '../report.service';
import { ReportPeriod } from './period-toggle/period-toggle.component';
import { ReportChartContext } from './report-chart-context';
import { ReportStatus } from './report-status';
import { periodRange, sortRows } from './report-tab-helpers';

const PERIODS: readonly ReportPeriod[] = ['d30', 'd90', 'd180', 'year', 'all'];

/**
 * The profit tab's state: two tables over one period, their charts, and their exports.
 *
 * @remarks Provided by the reports page and scoped to it (ADR 039), which keeps the lifetime the
 * state had as a page member while giving the tab a name of its own. Two tables rather than one
 * because the tab is one question - what the business earned - asked by product and by supplier
 * over the same window; splitting them would put one period signal in two owners.
 *
 * <p>Members carry no `profit` prefix: the collaborator is the namespace, so the page reads
 * `profit.rows()` where it used to read `profitRows()`.
 */
@Injectable()
export class ProfitTabState {
  private readonly reports = inject(ReportService);
  private readonly charts = inject(ReportChartContext);
  private readonly status = inject(ReportStatus);
  private readonly csv = inject(CsvExportService);

  readonly columns = ['name', 'sku', 'revenue', 'cost', 'grossProfit'];
  readonly supplierColumns = ['name', 'revenue', 'cost', 'grossProfit'];

  readonly rows = signal<ProductProfitReport[]>([]);
  readonly supplierRows = signal<SupplierProfitReport[]>([]);

  /**
   * Which column each profit table is sorted by, held apart from the rows themselves.
   *
   * <p>The rows above stay in the order the server sent for as long as they are loaded, and the
   * order on screen is derived from them below. Sorting in place instead - replacing the signal
   * with a sorted copy - destroys that original order on the first click, so the third click, which
   * clears the direction, has nothing to return to and leaves the last sorted order standing.
   */
  private readonly sort = signal<Sort>({ active: '', direction: '' });
  private readonly supplierSort = signal<Sort>({ active: '', direction: '' });

  readonly sortedRows = computed(() => sortRows(this.rows(), this.sort()));

  readonly sortedSupplierRows = computed(() => sortRows(this.supplierRows(), this.supplierSort()));

  // Presets rather than a date picker is a deliberate scope decision; a custom range is backlog.
  // One signal per tab rather than one shared: the two answer different questions, and a period
  // chosen for cash flow is not a period the reader asked profit for.
  readonly period = signal<ReportPeriod>('all');

  // Derived, not stored. Each one re-runs when its rows change - which is what the load methods
  // used to trigger by hand - and when the rendering context above changes, which nothing used to
  // trigger at all: a language switch left every chart showing the words it was built with.
  readonly marginOption = computed(() =>
    toMarginOption(this.rows(), this.charts.context().gaugeBands, this.charts.context().format)
  );

  readonly option = computed(() =>
    toProfitOption(this.rows(), this.charts.context().other, this.charts.context().format)
  );

  load(): void {
    this.status.error.set(null);
    this.status.loading.set(true);
    // Both queries take the same window: a chart filtered to a period beside a supplier table that
    // was not would be worse than no filter at all.
    const range = periodRange(this.period());

    this.reports.profitProducts(range.from, range.to).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        // A re-query answers in the server order, which is what the table showed before this
        // sorted by derivation rather than in place.
        this.sort.set({ active: '', direction: '' });
        this.status.loading.set(false);
      },
      error: (err: Error) => this.status.fail(err)
    });

    this.reports.profitSuppliers(range.from, range.to).subscribe({
      next: (rows) => {
        this.supplierRows.set(rows);
        this.supplierSort.set({ active: '', direction: '' });
      },
      error: (err: Error) => this.status.fail(err)
    });
  }

  /** Switches the profit window and refetches both profit queries, which share the one period. */
  setPeriod(period: ReportPeriod): void {
    // Same two guards as the cash-flow toggle: the group emits once with no value while it is
    // being created, and re-picking the current preset is no reason to go back to the server.
    if (!PERIODS.includes(period) || period === this.period()) {
      return;
    }
    this.period.set(period);
    this.load();
  }

  sortBy(sort: Sort): void {
    this.sort.set(sort);
  }

  sortSuppliersBy(sort: Sort): void {
    this.supplierSort.set(sort);
  }

  /** Exports the profit table as displayed, without the deleted marker the column renders. */
  export(): void {
    this.csv.export(
      'profit-products.csv',
      this.columns,
      // The sorted view, so the download is in the order the reader is looking at.
      this.sortedRows().map((row) => [row.name, row.sku, row.revenue, row.cost, row.grossProfit]),
      'reports.columns.'
    );
  }

  exportSuppliers(): void {
    this.csv.export(
      'profit-suppliers.csv',
      this.supplierColumns,
      this.sortedSupplierRows().map((row) => [row.name, row.revenue, row.cost, row.grossProfit]),
      'reports.columns.'
    );
  }
}

/**
 * Builds the overall-margin gauge, or null when there is no revenue to divide by. Returning
 * null rather than a zero gauge keeps a NaN off the dial and lets the template show the empty
 * state instead. Display-only arithmetic over server-authoritative figures, as with the
 * invoice totals.
 */
function toMarginOption(
  rows: ProductProfitReport[],
  bands: readonly GaugeBand[],
  format: ChartFormat
): ChartOption | null {
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  if (revenue === 0) {
    return null;
  }
  const profit = rows.reduce((sum, row) => sum + row.grossProfit, 0);
  const margin = Math.round((profit / revenue) * 1000) / 10;

  return {
    series: [
      {
        type: 'gauge',
        min: 0,
        max: 100,
        // Bands read low-to-high against the same thresholds a reader would apply by eye. The
        // colours come from the chart context, which is what makes them follow the theme; the
        // literals and the reason they are sanctioned live there.
        axisLine: { lineStyle: { width: 14, color: bands.map((band) => [band.upTo, band.color]) } },
        // The dial still runs 0-100 and its value is still 42.5; only the reading changes, from a
        // hardcoded '{value}%' to the decimal mark and percent spacing the reader's locale uses.
        detail: { formatter: (value: number) => format.percent(value), fontSize: 22 },
        data: [{ value: margin }]
      }
    ]
  };
}

/**
 * Plots the ten largest contributors plus the aggregated rest. What separates this page from the
 * dashboard is the exhaustive table behind the toggle, not an unabridged chart, which stopped
 * being readable the moment the inventory outgrew the seeded dataset.
 */
function toProfitOption(
  rows: ProductProfitReport[],
  otherLabel: string,
  format: ChartFormat
): ChartOption | null {
  if (rows.length === 0) {
    return null;
  }
  const ordered = topNWithRemainder(
    rows.map((row) => ({ name: row.name, value: row.grossProfit })),
    otherLabel
  ).sort((a, b) => a.value - b.value);

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value) => format.currency(value as number)
    },
    grid: { left: 8, right: 24, top: 8, bottom: 24, containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: (value: number) => format.currency(value) } },
    yAxis: { type: 'category', data: ordered.map((slice) => slice.name) },
    series: [{ type: 'bar', data: ordered.map((slice) => slice.value) }]
  };
}
