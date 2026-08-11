import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe } from '@ngx-translate/core';

import { StockStatusReport } from '../../../../core/api/api-models';
import { ChartComponent, ChartOption } from '../../../../shared/chart/chart.component';
import { AppCurrencyPipe } from '../../../../shared/format/app-currency.pipe';
import { ReportView, ReportViewToggleComponent } from '../report-view-toggle/report-view-toggle.component';

/** The stock tab's headline figures, as the page sums them from its loaded rows. */
export interface StockTotals {
  value: number;
  units: number;
  products: number;
}

/**
 * The stock tab's body: the totals strip and view toggle on one line, then the stock-value chart
 * or the sortable, filterable table behind it.
 *
 * @remarks
 * Presentational. Every figure it draws is computed by the page - the totals, the chart option and
 * the filtered rows all arrive as inputs - and every control it offers is announced rather than
 * acted on. The four outputs each answer a decision the page owns: which view a tab is on, the
 * filter term the export also reads, the sort that reorders the page's own row signal, and the
 * download itself, which needs the CSV service.
 *
 * The view toggle came along rather than staying beside the other tabs' toggles, because it shares
 * the strip's flex row with the totals: that row is one layout and cannot be split across a
 * component boundary.
 *
 * `hasRows` is separate from `rows` on purpose. The empty state and the heading above the table ask
 * whether the tab loaded anything at all, which a filter that matches nothing must not answer -
 * hiding the filter box because the filter emptied the table would leave no way to undo it.
 */
@Component({
  selector: 'app-stock-card',
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
  templateUrl: './stock-card.component.html',
  styleUrl: './stock-card.component.scss'
})
export class StockCardComponent {
  readonly view = input.required<ReportView>();

  /** Null when there is nothing to plot; the chart half shows its empty state instead. */
  readonly option = input.required<ChartOption | null>();

  /** Null until rows are loaded, which is when the strip has nothing to state. */
  readonly totals = input.required<StockTotals | null>();

  readonly filter = input.required<string>();

  /** Already narrowed by the page; the card renders what it is handed. */
  readonly rows = input.required<StockStatusReport[]>();

  /** Whether the tab loaded any rows at all, before the filter narrowed them. */
  readonly hasRows = input.required<boolean>();

  /** The page's own column list, which its CSV export uses for headers too. */
  readonly columns = input.required<string[]>();

  readonly viewChange = output<ReportView>();
  readonly filterChange = output<string>();
  readonly sortChange = output<Sort>();
  readonly exportRequested = output<void>();
}
