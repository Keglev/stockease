import { Injectable, computed, inject, signal } from '@angular/core';
import { Sort } from '@angular/material/sort';

import { LossByRemark, LossReport } from '../../../core/api/api-models';
import { topNWithRemainder } from '../../../shared/chart/chart-data';
import { ChartFormat } from '../../../shared/chart/chart-format';
import { ChartOption } from '../../../shared/chart/chart.component';
import { CsvExportService } from '../../../shared/csv/csv-export.service';
import { ReportService } from '../report.service';
import { ReportPeriod } from './period-toggle/period-toggle.component';
import { ReportChartContext } from './report-chart-context';
import { ReportStatus } from './report-status';
import { matchingNameOrSku, periodRange, sortRows } from './report-tab-helpers';

const PERIODS: readonly ReportPeriod[] = ['d30', 'd90', 'd180', 'year', 'all'];

/**
 * The losses tab's state: what was written off, by product and by cause, over one window.
 *
 * @remarks Provided by the reports page and scoped to it (ADR 039). The tab reads two endpoints
 * that answer the same window differently, and holding both here is what keeps that pairing
 * legible - the per-product rows and the by-cause breakdown are one question asked twice, not two
 * tabs sharing a period.
 *
 * <p>Members carry no `loss` prefix: the collaborator is the namespace.
 */
@Injectable()
export class LossTabState {
  private readonly reports = inject(ReportService);
  private readonly charts = inject(ReportChartContext);
  private readonly status = inject(ReportStatus);
  private readonly csv = inject(CsvExportService);

  readonly columns = ['name', 'sku', 'lostUnits', 'destroyedUnits', 'lossValue'];

  readonly rows = signal<LossReport[]>([]);
  readonly remarkRows = signal<LossByRemark[]>([]);

  /** The same narrowing on the stock and loss tables; the question a reader asks of a product
   *  list does not change with which report they are reading. */
  readonly filter = signal('');

  readonly filteredRows = computed(() => matchingNameOrSku(this.rows(), this.filter()));

  /** The losses tab's headline figures, on the same derivation and the same unfiltered basis. */
  readonly totals = computed(() => {
    const rows = this.rows();
    if (rows.length === 0) {
      return null;
    }
    return {
      value: rows.reduce((sum, row) => sum + row.lossValue, 0),
      lost: rows.reduce((sum, row) => sum + row.lostUnits, 0),
      destroyed: rows.reduce((sum, row) => sum + row.destroyedUnits, 0)
    };
  });

  // Presets rather than a date picker is a deliberate scope decision; a custom range is backlog.
  // One signal per tab rather than one shared: the two answer different questions, and a period
  // chosen for cash flow is not a period the reader asked profit for.
  readonly period = signal<ReportPeriod>('all');

  readonly option = computed(() =>
    toLossOption(this.rows(), this.charts.context().other, this.charts.context().format)
  );

  load(): void {
    this.status.error.set(null);
    this.status.loading.set(true);
    const range = periodRange(this.period());

    this.reports.losses(range.from, range.to).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.status.loading.set(false);
      },
      error: (err: Error) => this.status.fail(err)
    });

    // The breakdown is a second read of the same window, not a slice of the rows above: the
    // per-product response carries no remark, so the grouping cannot be derived client-side.
    // Fired alongside rather than chained, because neither answer needs the other.
    this.reports.lossesByRemark(range.from, range.to).subscribe({
      next: (rows) => this.remarkRows.set(rows),
      // The tab shows one error line, and it is already the one the load above sets on the same
      // failure. Sharing it keeps a doubled message off the screen when the API is simply down.
      error: (err: Error) => {
        this.remarkRows.set([]);
        this.status.fail(err);
      }
    });
  }

  /** Switches the loss window and refetches, since the period is a server-side filter. */
  setPeriod(period: ReportPeriod): void {
    // Same two guards as the other toggles: the group emits once with no value while it is being
    // created, and re-picking the current preset is no reason to go back to the server.
    if (!PERIODS.includes(period) || period === this.period()) {
      return;
    }
    this.period.set(period);
    this.load();
  }

  setFilter(value: string): void {
    this.filter.set(value);
  }

  sortBy(sort: Sort): void {
    this.rows.update((rows) => sortRows(rows, sort));
  }

  export(): void {
    this.csv.export(
      'losses.csv',
      this.columns,
      this.filteredRows().map((row) => [
        row.name,
        row.sku,
        row.lostUnits,
        row.destroyedUnits,
        row.lossValue
      ]),
      'reports.columns.'
    );
  }
}

/**
 * Builds the loss-share pie, or null when nothing has actually been written off. A pie of
 * zero-valued slices draws no arcs at all, so the empty state is the honest rendering.
 */
function toLossOption(
  rows: LossReport[],
  otherLabel: string,
  format: ChartFormat
): ChartOption | null {
  const slices = rows.filter((row) => row.lossValue > 0);
  if (slices.length === 0) {
    return null;
  }

  return {
    tooltip: { trigger: 'item', valueFormatter: (value) => format.currency(value as number) },
    legend: { type: 'scroll', bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['35%', '65%'],
        data: topNWithRemainder(
          slices.map((row) => ({ name: row.name, value: row.lossValue })),
          otherLabel
        )
      }
    ]
  };
}
