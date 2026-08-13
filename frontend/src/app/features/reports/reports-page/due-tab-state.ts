import { Injectable, computed, inject, signal } from '@angular/core';

import { DueDateBucket, InvoiceDueSummary } from '../../../core/api/api-models';
import { ChartFormat } from '../../../shared/chart/chart-format';
import { ChartOption } from '../../../shared/chart/chart.component';
import { bucketValueAt } from '../../../shared/chart/due-buckets';
import { ReportService } from '../report.service';
import { ReportChartContext } from './report-chart-context';
import { ReportStatus } from './report-status';

/**
 * The due-dates tab's state: what is outstanding, charted by due date and listed two ways.
 *
 * @remarks Provided by the reports page and scoped to it (ADR 039). The only tab with neither a
 * period nor an export - it always answers about the whole outstanding ledger, and its two lists
 * are short by construction - so it is the smallest state on the page and the one that shows the
 * boundary costs nothing where there is little to hold.
 *
 * <p>Members carry no `due` prefix: the collaborator is the namespace.
 */
@Injectable()
export class DueTabState {
  private readonly reports = inject(ReportService);
  private readonly charts = inject(ReportChartContext);
  private readonly status = inject(ReportStatus);

  readonly buckets = signal<DueDateBucket[]>([]);
  readonly dueSoonRows = signal<InvoiceDueSummary[]>([]);
  readonly overdueRows = signal<InvoiceDueSummary[]>([]);

  readonly option = computed(() => toDueOption(this.buckets(), this.charts.context().format));

  load(): void {
    this.reports.dueDates().subscribe({
      next: (rows) => {
        this.buckets.set(rows);
        this.status.loading.set(false);
      },
      error: (err: Error) => this.status.fail(err)
    });

    this.reports.dueSoon().subscribe({
      next: (rows) => this.dueSoonRows.set(rows),
      error: (err: Error) => this.status.fail(err)
    });

    this.reports.overdue().subscribe({
      next: (rows) => this.overdueRows.set(rows),
      error: (err: Error) => this.status.fail(err)
    });
  }
}

function toDueOption(buckets: DueDateBucket[], format: ChartFormat): ChartOption | null {
  if (buckets.length === 0) {
    return null;
  }
  const dates = [...new Set(buckets.map((bucket) => bucket.dueDate))].sort();
  const types = [...new Set(buckets.map((bucket) => bucket.invoiceType))].sort();

  return {
    tooltip: { trigger: 'axis', valueFormatter: (value) => format.currency(value as number) },
    // The legend sits below the axis rather than floating over it: with containLabel the grid's
    // bottom inset has to cover the date labels AND the legend row, which the previous 24px did
    // not, so the two drew on top of each other at both chart heights.
    legend: { bottom: 0 },
    grid: { left: 8, right: 24, top: 32, bottom: 48, containLabel: true },
    // Raw ISO keys as data, the reader's format as labels - the sort above depends on the keys.
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLabel: { formatter: (value: string) => format.date(value) }
    },
    yAxis: { type: 'value', axisLabel: { formatter: (value: number) => format.currency(value) } },
    series: types.map((type) => ({
      name: type,
      type: 'line' as const,
      areaStyle: {},
      data: dates.map((date) => bucketValueAt(buckets, date, type))
    }))
  };
}
