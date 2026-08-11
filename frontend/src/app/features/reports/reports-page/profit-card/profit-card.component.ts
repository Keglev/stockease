import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe } from '@ngx-translate/core';

import { ProductProfitReport, SupplierProfitReport } from '../../../../core/api/api-models';
import { ChartComponent, ChartOption } from '../../../../shared/chart/chart.component';
import { AppCurrencyPipe } from '../../../../shared/format/app-currency.pipe';
import { ReportView } from '../report-view-toggle/report-view-toggle.component';

/**
 * The profit tab's body below the two toggles: the margin gauge beside the profit-by-product
 * chart, or the per-product and per-supplier tables.
 *
 * @remarks
 * Presentational. Both chart options and both row sets are computed by the page and arrive as
 * inputs; the five outputs each answer a decision the page owns - the two sorts, which set the
 * page's own sort signals, the two exports, which need the CSV service, and the row drill-down,
 * which fetches a product's detail before opening a dialog over it.
 *
 * Unlike the stock and losses cards this one takes no filter and no `hasRows`: the profit tab has
 * no filter box, and each table gates its own empty state on its own array.
 *
 * Neither toggle came along. The period toggle refetches, and the view toggle stands alone above
 * this card rather than sharing a strip with figures the way the stock and losses ones do.
 */
@Component({
  selector: 'app-profit-card',
  imports: [
    AppCurrencyPipe,
    ChartComponent,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSortModule,
    MatTableModule,
    TranslatePipe
  ],
  templateUrl: './profit-card.component.html',
  styleUrl: './profit-card.component.scss'
})
export class ProfitCardComponent {
  readonly view = input.required<ReportView>();

  /** Null when there is no revenue to divide by; the card shows its empty state instead. */
  readonly marginOption = input.required<ChartOption | null>();

  readonly profitOption = input.required<ChartOption | null>();

  /** Already in the order the page's sort state asks for; the card renders what it is handed. */
  readonly profitRows = input.required<ProductProfitReport[]>();
  readonly supplierRows = input.required<SupplierProfitReport[]>();

  /** The page's own column lists, which its two CSV exports use for headers too. */
  readonly profitColumns = input.required<string[]>();
  readonly supplierColumns = input.required<string[]>();

  readonly profitSortChange = output<Sort>();
  readonly supplierSortChange = output<Sort>();
  readonly exportProfitRequested = output<void>();
  readonly exportSuppliersRequested = output<void>();

  /** A product row the reader asked to see the detail of, by click or by Enter. */
  readonly rowActivated = output<ProductProfitReport>();
}
