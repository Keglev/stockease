import { Component, computed, input, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { TranslatePipe } from '@ngx-translate/core';

import { createChartContext } from '../../../shared/chart/chart-context';
import { ChartSlice, topNWithRemainder } from '../../../shared/chart/chart-data';
import { ChartFormat } from '../../../shared/chart/chart-format';
import { ChartComponent, ChartOption } from '../../../shared/chart/chart.component';
import { AppCurrencyPipe } from '../../../shared/format/app-currency.pipe';
import { CARD_VIEWS, CardView } from '../card-view';

/**
 * The profit-by-product card: the same top slices read as a chart or as rows.
 *
 * @remarks
 * Presentational. It fetches nothing and reports nothing upward - the dashboard owns the request,
 * the KPI summed from it, and the error banner - so this card holds only which half is on screen
 * and the derivations behind it.
 *
 * It takes the source rows rather than finished slices, because the remainder bucket carries a
 * translated name. Ranking them here keeps that name inside a derivation that rebuilds on a
 * language switch; baking it in upstream is what once left "Other" on screen in German.
 */
@Component({
  selector: 'app-profit-card',
  imports: [
    AppCurrencyPipe,
    ChartComponent,
    MatButtonToggleModule,
    MatCardModule,
    TranslatePipe
  ],
  templateUrl: './profit-card.component.html',
  styleUrl: './profit-card.component.scss'
})
export class ProfitCardComponent {
  /** Null until the first load, so no empty chart flashes. */
  readonly data = input<{ name: string; value: number }[] | null>(null);
  readonly chartHeight = input.required<string>();

  /**
   * Whether the source behind this card is still in flight.
   *
   * <p>Distinct from a null payload, which is what the card already had: null is "nothing to draw"
   * and covers a load that failed just as well as one still running, and the card cannot tell the
   * two apart. The dashboard owns the request and therefore owns the answer.
   */
  readonly loading = input(false);

  private readonly chartContext = createChartContext();

  private readonly profitSlices = computed(() => {
    const rows = this.data();
    return rows ? topNWithRemainder(rows, this.chartContext().other) : null;
  });

  protected readonly profitOption = computed(() => {
    const slices = this.profitSlices();
    return slices ? toProfitOption(slices, this.chartContext().format) : null;
  });

  protected readonly profitRows = computed(() => this.profitSlices() ?? []);

  protected readonly profitView = signal<CardView>('chart');

  /** Switches the profit card between its chart and the same slices as rows. */
  protected setProfitView(view: CardView): void {
    // The group emits once with no value while it is being created; without this the card would
    // end up on neither view. Same guard as the reports page's period presets.
    if (CARD_VIEWS.includes(view)) {
      this.profitView.set(view);
    }
  }
}

// Takes the already-ranked slices rather than the raw rows, so the chart and the table below it
// can never disagree about what the top ten are.
function toProfitOption(slices: ChartSlice[], format: ChartFormat): ChartOption {
  // A category axis draws its first entry at the bottom, so the order is reversed to put the
  // most profitable product at the top of the chart.
  const ordered = [...slices].reverse();

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
