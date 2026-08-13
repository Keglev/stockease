import { Injectable, computed, inject, signal } from '@angular/core';
import { Sort } from '@angular/material/sort';

import { StockStatusReport } from '../../../core/api/api-models';
import { topNWithRemainder } from '../../../shared/chart/chart-data';
import { ChartFormat } from '../../../shared/chart/chart-format';
import { ChartOption } from '../../../shared/chart/chart.component';
import { CsvExportService } from '../../../shared/csv/csv-export.service';
import { ReportService } from '../report.service';
import { ReportChartContext } from './report-chart-context';
import { ReportStatus } from './report-status';
import { matchingNameOrSku, sortRows } from './report-tab-helpers';

/**
 * The stock tab's state: what the business holds, its totals strip, its chart and its export.
 *
 * @remarks Provided by the reports page and scoped to it (ADR 039). The simplest of the tab states
 * and deliberately converted alongside the profit tab rather than after it: between them the two
 * exercise every part of the collaborator boundary - a period and no period, a derived sort and an
 * in-place one, a filtered export and a sorted one - which is what makes them a proof of the
 * pattern rather than one example of it.
 *
 * <p>Members carry no `stock` prefix: the collaborator is the namespace.
 */
@Injectable()
export class StockTabState {
  private readonly reports = inject(ReportService);
  private readonly charts = inject(ReportChartContext);
  private readonly status = inject(ReportStatus);
  private readonly csv = inject(CsvExportService);

  readonly columns = ['name', 'sku', 'soldUnits', 'soldRevenue', 'inStockUnits', 'inStockValue'];

  readonly rows = signal<StockStatusReport[]>([]);

  /** The same narrowing on the stock and loss tables; the question a reader asks of a product
   *  list does not change with which report they are reading. */
  readonly filter = signal('');

  readonly filteredRows = computed(() => matchingNameOrSku(this.rows(), this.filter()));

  /**
   * The stock tab's headline figures, summed from the rows the tab already loaded.
   *
   * <p>Derived rather than fetched, so a single source answers both halves of the tab: a strip and
   * the table beneath it cannot disagree when the strip is the table added up. The unfiltered rows
   * on purpose - the strip states what the business holds, which a text box must not appear to
   * change.
   */
  readonly totals = computed(() => {
    const rows = this.rows();
    if (rows.length === 0) {
      return null;
    }
    return {
      value: rows.reduce((sum, row) => sum + row.inStockValue, 0),
      units: rows.reduce((sum, row) => sum + row.inStockUnits, 0),
      products: rows.length
    };
  });

  readonly option = computed(() =>
    toStockOption(this.rows(), this.charts.context().other, this.charts.context().format)
  );

  load(): void {
    this.reports.stockStatus().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.status.loading.set(false);
      },
      error: (err: Error) => this.status.fail(err)
    });
  }

  setFilter(value: string): void {
    this.filter.set(value);
  }

  sortBy(sort: Sort): void {
    this.rows.update((rows) => sortRows(rows, sort));
  }

  export(): void {
    this.csv.export(
      'stock-status.csv',
      this.columns,
      // The filtered rows, as on the cash-flow tab: the export mirrors what the user is looking at.
      this.filteredRows().map((row) => [
        row.name,
        row.sku,
        row.soldUnits,
        row.soldRevenue,
        row.inStockUnits,
        row.inStockValue
      ]),
      'reports.columns.'
    );
  }
}

function toStockOption(
  rows: StockStatusReport[],
  otherLabel: string,
  format: ChartFormat
): ChartOption | null {
  if (rows.length === 0) {
    return null;
  }
  // Reversed because a category axis draws its first entry at the bottom.
  const ordered = topNWithRemainder(
    rows.map((row) => ({ name: row.name, value: row.inStockValue })),
    otherLabel
  ).reverse();

  return {
    // inStockValue, not a unit count: this bar is what the stock on hand is worth.
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
