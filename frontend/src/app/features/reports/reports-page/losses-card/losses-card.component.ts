import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe } from '@ngx-translate/core';

import { LossByRemark, LossReport } from '../../../../core/api/api-models';
import { ChartComponent, ChartOption } from '../../../../shared/chart/chart.component';
import { AppCurrencyPipe } from '../../../../shared/format/app-currency.pipe';
import { ReportView, ReportViewToggleComponent } from '../report-view-toggle/report-view-toggle.component';

/** The losses tab's headline figures, as the page sums them from its loaded rows. */
export interface LossTotals {
  value: number;
  lost: number;
  destroyed: number;
}

/**
 * The losses tab's body below the period toggle: the totals strip beside the view toggle, the
 * loss-share chart or the per-product table behind it, and the by-cause breakdown beneath both.
 *
 * @remarks
 * Presentational, on the same terms as the stock card. Every figure arrives as an input and every
 * control is announced rather than acted on: the view switch, the filter term the export also
 * reads, the sort that reorders the page's own row signal, and the download, which needs the CSV
 * service the page holds.
 *
 * The period toggle stayed in the page. It stands alone above the strip rather than sharing a row
 * with anything here, and picking a preset refetches - a decision the shell owns. The view toggle
 * came along for the opposite reason: it shares the strip's flex row with the totals, and that row
 * is one layout.
 *
 * `hasRows` is separate from `rows` for the reason the stock card records: the empty state and the
 * heading ask whether the tab loaded anything, which a filter matching nothing must not answer.
 */
@Component({
  selector: 'app-losses-card',
  imports: [
    AppCurrencyPipe,
    ChartComponent,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSortModule,
    MatTableModule,
    ReportViewToggleComponent,
    TranslatePipe
  ],
  templateUrl: './losses-card.component.html',
  styleUrl: './losses-card.component.scss'
})
export class LossesCardComponent {
  readonly view = input.required<ReportView>();

  /** Null when nothing has been written off; the chart half shows its empty state instead. */
  readonly option = input.required<ChartOption | null>();

  /** Null until rows are loaded, which is when the strip has nothing to state. */
  readonly totals = input.required<LossTotals | null>();

  readonly filter = input.required<string>();

  /** Already narrowed by the page; the card renders what it is handed. */
  readonly rows = input.required<LossReport[]>();

  /** Whether the tab loaded any rows at all, before the filter narrowed them. */
  readonly hasRows = input.required<boolean>();

  /** The page's own column list, which its CSV export uses for headers too. */
  readonly columns = input.required<string[]>();

  /** The same write-offs grouped by cause; a second read of the window, not a slice of `rows`. */
  readonly remarkRows = input.required<LossByRemark[]>();

  // The breakdown's columns, unlike the per-product ones, are this card's alone: nothing outside
  // the table below has ever read them, and no export writes them.
  protected readonly remarkColumns = ['remark', 'lostUnits', 'destroyedUnits', 'lossValue'];

  readonly viewChange = output<ReportView>();
  readonly filterChange = output<string>();
  readonly sortChange = output<Sort>();
  readonly exportRequested = output<void>();
}
