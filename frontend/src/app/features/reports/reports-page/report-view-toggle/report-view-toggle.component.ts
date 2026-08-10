import { Component, input, output } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { TranslatePipe } from '@ngx-translate/core';

/** Which half of a tab is on screen; the two never share the vertical space any more. */
export type ReportView = 'chart' | 'table';

/**
 * The chart-or-detail switch a report tab draws its two halves behind.
 *
 * @remarks
 * Presentational. It announces the half that was picked and holds nothing; which half is on screen
 * is per-tab state the page owns, and so is any load the switch should trigger - the cash-flow
 * table's rows are fetched on the first switch to them, and only the page knows whether that has
 * already happened.
 *
 * The second option's label is an input because one tab disagrees about what its other half is:
 * the due-dates tab shows two navigation lists over invoices rather than a dataset, so it reads
 * "list" where the rest read "table". The VALUE stays `table` on all five - it is the same state
 * the page stores, and only the wording differs.
 */
@Component({
  selector: 'app-report-view-toggle',
  imports: [MatButtonToggleModule, TranslatePipe],
  templateUrl: './report-view-toggle.component.html',
  styleUrl: './report-view-toggle.component.scss'
})
export class ReportViewToggleComponent {
  readonly value = input.required<ReportView>();

  readonly tableLabelKey = input('reports.view.table');

  readonly selected = output<ReportView>();
}
