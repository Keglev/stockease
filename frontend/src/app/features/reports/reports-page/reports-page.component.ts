import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslatePipe } from '@ngx-translate/core';

import { ProductProfitReport } from '../../../core/api/api-models';
import { ProfitDetailDialogComponent } from '../profit-detail-dialog/profit-detail-dialog.component';
import { ReportService } from '../report.service';
import { AnalyticsCardComponent } from './analytics-card/analytics-card.component';
import { CashFlowCardComponent } from './cash-flow-card/cash-flow-card.component';
import { ChangesCardComponent } from './changes-card/changes-card.component';
import { DueDatesCardComponent } from './due-dates-card/due-dates-card.component';
import { LossesCardComponent } from './losses-card/losses-card.component';
import { PeriodToggleComponent } from './period-toggle/period-toggle.component';
import { ProfitCardComponent } from './profit-card/profit-card.component';
import { StockCardComponent } from './stock-card/stock-card.component';
import { SupplierProductPickerComponent } from './supplier-product-picker/supplier-product-picker.component';
import { ReportView, ReportViewToggleComponent } from './report-view-toggle/report-view-toggle.component';
import { AnalyticsTabState } from './analytics-tab-state';
import { CashFlowTabState } from './cash-flow-tab-state';
import { ChangeTabState } from './change-tab-state';
import { DueTabState } from './due-tab-state';
import { LossTabState } from './loss-tab-state';
import { ProfitTabState } from './profit-tab-state';
import { ReportChartContext } from './report-chart-context';
import { ReportPickerFeed } from './report-picker-feed';
import { ReportStatus } from './report-status';
import { periodRange } from './report-tab-helpers';
import { StockTabState } from './stock-tab-state';

const PROFIT_TAB = 0;
// Cash flow sits second, next to profit: the two answer the paired questions of what the business
// earned and what it actually collected, and reading one usually prompts the other.
const CASH_FLOW_TAB = 1;
const STOCK_TAB = 2;
const LOSSES_TAB = 3;
const DUE_TAB = 4;
// Last, and appended rather than slotted in: the audit trail answers a different kind of question
// from the five figures before it, and renumbering them would touch every tab's tests to say so.
const CHANGES_TAB = 5;
// Appended last for the same reason the changes tab was: it asks about one product rather than the
// whole business, and renumbering the six before it would touch every tab's tests to say so.
const ANALYTICS_TAB = 6;

const TAB_COUNT = 7;


/**
 * Detail view over the reporting endpoints, each tab switching between its chart and its sortable
 * table. The dashboard stays the at-a-glance summary; this page is where the full figures live,
 * which is why the tables here are exhaustive and exportable while the charts are a top ten.
 *
 * @remarks
 * The changes tab is the one exception, and reads the audit module rather than the reporting
 * one: it lists events rather than figures, so it has a table and no chart.
 */
@Component({
  selector: 'app-reports-page',
  imports: [
    AnalyticsCardComponent,
    CashFlowCardComponent,
    ChangesCardComponent,
    DueDatesCardComponent,
    LossesCardComponent,
    MatButtonModule,
    MatProgressBarModule,
    MatTabsModule,
    PeriodToggleComponent,
    ProfitCardComponent,
    ReportViewToggleComponent,
    StockCardComponent,
    SupplierProductPickerComponent,
    TranslatePipe
  ],
  templateUrl: './reports-page.component.html',
  styleUrl: './reports-page.component.scss',
  // Per-tab state, scoped to the page so it is created and discarded with it (ADR 039). The two
  // shared ones come first because every tab state injects them.
  providers: [
    ReportChartContext,
    ReportStatus,
    ProfitTabState,
    StockTabState,
    LossTabState,
    DueTabState,
    ChangeTabState,
    CashFlowTabState,
    AnalyticsTabState,
    ReportPickerFeed
  ]
})
export class ReportsPageComponent implements OnInit {
  protected readonly charts = inject(ReportChartContext);
  protected readonly status = inject(ReportStatus);
  protected readonly profit = inject(ProfitTabState);
  protected readonly stock = inject(StockTabState);
  protected readonly losses = inject(LossTabState);
  protected readonly due = inject(DueTabState);
  protected readonly changes = inject(ChangeTabState);
  protected readonly cashFlow = inject(CashFlowTabState);
  protected readonly analytics = inject(AnalyticsTabState);
  protected readonly pickers = inject(ReportPickerFeed);

  private readonly reports = inject(ReportService);
  private readonly dialog = inject(MatDialog);

  protected readonly selectedTab = signal(PROFIT_TAB);

  // One entry per tab so a chosen view survives leaving the tab and coming back; charts open
  // first because the chart is what the page is scanned for.
  // Seven entries for five readers: the changes and analytics tabs carry no view toggle, so their
  // slots are never read. Indexing by tab number is what keeps every other slot addressable by the
  // number the tab already has, and two unread booleans are cheaper than a second numbering.
  private readonly views = signal<ReportView[]>(Array<ReportView>(TAB_COUNT).fill('chart'));

  // Loading every tab on open would fire eight report queries against aggregate SQL for tabs the
  // user may never look at, so each tab fetches on its first activation only.
  private readonly loadedTabs = new Set<number>();

  ngOnInit(): void {
    this.activate(PROFIT_TAB);
  }

  /** Loads a tab the first time it is opened and leaves it alone on every later visit. */
  protected activate(index: number): void {
    this.selectedTab.set(index);
    if (this.loadedTabs.has(index)) {
      return;
    }
    this.loadedTabs.add(index);
    this.loadTab(index);
  }

  /** Refetches the visible tab only; the other three keep whatever they already hold. */
  protected refresh(): void {
    this.loadTab(this.selectedTab());
  }

  protected viewOf(tab: number): ReportView {
    return this.views()[tab];
  }

  protected setView(tab: number, view: ReportView): void {
    this.views.update((current) => current.map((entry, index) => (index === tab ? view : entry)));
    if (tab === CASH_FLOW_TAB && view === 'table') {
      this.cashFlow.loadProductsIfNeeded();
    }
  }

  /** Fetches the row's own detail before opening the dialog, which is a pure presenter. */
  protected openDetail(row: ProductProfitReport): void {
    // The tab's active period, so the dialog never contradicts the table row that opened it.
    const range = periodRange(this.profit.period());

    this.reports.profitProductDetail(row.productId, range.from, range.to).subscribe({
      next: (detail) => this.dialog.open(ProfitDetailDialogComponent, { data: detail }),
      error: (err: Error) => this.status.error.set(err.message)
    });
  }

  private loadTab(index: number): void {
    this.status.error.set(null);
    this.status.loading.set(true);

    switch (index) {
      case CASH_FLOW_TAB:
        return this.cashFlow.load();
      case STOCK_TAB:
        return this.stock.load();
      case LOSSES_TAB:
        return this.losses.load();
      case DUE_TAB:
        return this.due.load();
      case CHANGES_TAB:
        return this.changes.load();
      case ANALYTICS_TAB:
        return this.analytics.load();
      default:
        return this.profit.load();
    }
  }

}
