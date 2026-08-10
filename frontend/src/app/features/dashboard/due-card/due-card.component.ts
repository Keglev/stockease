import { Component, computed, input, output, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { DueDateBucket, InvoiceDueSummary } from '../../../core/api/api-models';
import { createChartContext } from '../../../shared/chart/chart-context';
import { ChartFormat } from '../../../shared/chart/chart-format';
import { ChartComponent, ChartOption } from '../../../shared/chart/chart.component';
import { AppDatePipe } from '../../../shared/format/app-date.pipe';
import { CARD_VIEWS, CardView } from '../card-view';

/**
 * The upcoming-due-dates card: the bucket chart, or the invoices behind the same window.
 *
 * @remarks
 * Presentational. It fetches nothing and owns no error state; the dashboard holds both requests
 * and decides when the list is worth loading.
 *
 * It carries one output, which is the exception to that. The rows behind the list are fetched
 * lazily on the first switch to it, and only the dashboard knows whether that has already
 * happened - so the card announces the switch and the dashboard decides. Without it the rows
 * would have to be fetched eagerly for a list most readers never open.
 */
@Component({
  selector: 'app-due-card',
  imports: [
    AppDatePipe,
    ChartComponent,
    MatButtonToggleModule,
    MatCardModule,
    RouterLink,
    TranslatePipe
  ],
  templateUrl: './due-card.component.html',
  styleUrl: './due-card.component.scss'
})
export class DueCardComponent {
  /** Null until the first load, so no empty chart flashes. */
  readonly buckets = input<DueDateBucket[] | null>(null);
  readonly dueSoonRows = input<InvoiceDueSummary[]>([]);
  readonly chartHeight = input.required<string>();

  /** Announces the switch so the dashboard can load the list the first time it is opened. */
  readonly viewChange = output<CardView>();

  private readonly chartContext = createChartContext();

  protected readonly dueDateOption = computed(() => {
    const buckets = this.buckets();
    return buckets ? toDueDateOption(buckets, this.chartContext().format) : null;
  });

  protected readonly dueView = signal<CardView>('chart');

  /**
   * Switches the due card between the bucket chart and the invoices behind the same window.
   */
  protected setDueView(view: CardView): void {
    // Same guard as the profit card: the group emits once with no value while it is being created.
    if (!CARD_VIEWS.includes(view)) {
      return;
    }
    this.dueView.set(view);
    this.viewChange.emit(view);
  }
}

function toDueDateOption(buckets: DueDateBucket[], format: ChartFormat): ChartOption {
  const dates = [...new Set(buckets.map((bucket) => bucket.dueDate))].sort();
  const types = [...new Set(buckets.map((bucket) => bucket.invoiceType))].sort();

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value) => format.currency(value as number)
    },
    // The legend sits below the axis rather than floating over it: with containLabel the grid's
    // bottom inset has to cover the rotated date labels AND the legend row, which the previous
    // 24px did not, so the two drew on top of each other at both chart heights.
    legend: { bottom: 0 },
    grid: { left: 8, right: 24, top: 32, bottom: 48, containLabel: true },
    // The axis keeps the raw ISO keys - they are what the series are indexed by and what sorts
    // correctly - and shows the reader's date format through the label formatter instead.
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { formatter: (value: string) => format.date(value) }
    },
    yAxis: { type: 'value', axisLabel: { formatter: (value: number) => format.currency(value) } },
    // One stacked series per invoice type: the bar height is what falls due on that date and
    // the split shows how much of it is money in versus money out.
    series: types.map((type) => ({
      name: type,
      type: 'bar' as const,
      stack: 'due',
      data: dates.map((date) => valueOf(buckets, date, type))
    }))
  };
}

function valueOf(buckets: DueDateBucket[], date: string, type: string): number {
  const match = buckets.find((bucket) => bucket.dueDate === date && bucket.invoiceType === type);
  return match ? match.totalValue : 0;
}
