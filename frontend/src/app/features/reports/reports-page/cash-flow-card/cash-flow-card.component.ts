import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe } from '@ngx-translate/core';

import { CashFlowProductRow } from '../../../../core/api/api-models';
import { ChartComponent, ChartOption } from '../../../../shared/chart/chart.component';
import { AppCurrencyPipe } from '../../../../shared/format/app-currency.pipe';
import { ReportView, ReportViewToggleComponent } from '../report-view-toggle/report-view-toggle.component';

/** The cash-flow tab's headline figures, as the page sums them from the monthly buckets. */
export interface CashFlowTotals {
  inflow: number;
  outflow: number;
  net: number;
}

/**
 * The cash-flow tab's body below the search row: the totals strip beside the view toggle, then the
 * monthly timeline or the per-product table behind it.
 *
 * @remarks
 * Presentational. The totals, the chart option and the rows are all computed by the page, and the
 * three controls are announced rather than acted on: the view switch, the filter term the export
 * also reads, and the download, which needs the CSV service.
 *
 * No sort. This table is the one report table with no sortable columns - the per-product breakdown
 * is read against the timeline above it rather than reordered - so there is no `sortChange` here.
 *
 * `hasRows` gates both the heading and the empty state, and it asks whether the per-product query
 * has answered with anything. That query is lazy: the chart half never needs it, so the page fetches
 * it on the first switch to the table. Until then this renders the empty state, which is the honest
 * reading of a table whose rows have not been asked for yet.
 */
@Component({
  selector: 'app-cash-flow-card',
  imports: [
    AppCurrencyPipe,
    ChartComponent,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTableModule,
    ReportViewToggleComponent,
    TranslatePipe
  ],
  templateUrl: './cash-flow-card.component.html',
  styleUrl: './cash-flow-card.component.scss'
})
export class CashFlowCardComponent {
  readonly view = input.required<ReportView>();

  /** Null when no month moved money; the chart half shows its empty state instead. */
  readonly option = input.required<ChartOption | null>();

  /** Null until the timeline is loaded, which is when the strip has nothing to state. */
  readonly totals = input.required<CashFlowTotals | null>();

  readonly filter = input.required<string>();

  /** Already narrowed by the page; the card renders what it is handed. */
  readonly rows = input.required<CashFlowProductRow[]>();

  /** Whether the per-product query has answered with rows, before the filter narrowed them. */
  readonly hasRows = input.required<boolean>();

  /** The page's own column list, which its CSV export uses for headers too. */
  readonly columns = input.required<string[]>();

  readonly viewChange = output<ReportView>();
  readonly filterChange = output<string>();
  readonly exportRequested = output<void>();
}
