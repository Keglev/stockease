import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { InvoiceDueSummary } from '../../../../core/api/api-models';
import { ChartComponent, ChartOption } from '../../../../shared/chart/chart.component';
import { AppDatePipe } from '../../../../shared/format/app-date.pipe';
import { ReportView } from '../report-view-toggle/report-view-toggle.component';

/**
 * The due-dates tab's body: the outstanding-value chart, or the two invoice lists behind it.
 *
 * @remarks
 * Presentational, and unlike the dashboard's due card it carries no output at all. That card
 * announces the switch to its list because the dashboard fetches those rows lazily and is the only
 * side that knows whether it has already done so. This tab loads all three of its queries together
 * on activation, so both halves are already in hand when either is drawn - there is nothing here
 * for the page to decide, and no event worth raising.
 *
 * Which half is showing, the chart option and both sets of rows all arrive as inputs: the page owns
 * the fetches and the chart derivation, and this renders what they produced.
 */
@Component({
  selector: 'app-due-dates-card',
  imports: [AppDatePipe, ChartComponent, MatCardModule, RouterLink, TranslatePipe],
  templateUrl: './due-dates-card.component.html',
  styleUrl: './due-dates-card.component.scss'
})
export class DueDatesCardComponent {
  readonly view = input.required<ReportView>();

  /** Null when the window holds nothing to plot; the chart half shows its empty state instead. */
  readonly option = input.required<ChartOption | null>();

  readonly dueSoonRows = input.required<InvoiceDueSummary[]>();
  readonly overdueRows = input.required<InvoiceDueSummary[]>();
}
