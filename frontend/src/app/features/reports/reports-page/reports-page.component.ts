import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  CashFlowReport,
  DueDateBucket,
  InvoiceDueSummary,
  LossReport,
  ProductProfitReport,
  StockStatusReport,
  SupplierProfitReport
} from '../../../core/api/api-models';
import { LanguageService } from '../../../core/i18n/language.service';
import { topNWithRemainder } from '../../../shared/chart/chart-data';
import { ChartComponent, ChartOption } from '../../../shared/chart/chart.component';
import { CSV_DOWNLOADER, buildCsv } from '../../../shared/csv/csv-export';
import { ProfitDetailDialogComponent } from '../profit-detail-dialog/profit-detail-dialog.component';
import { ReportService } from '../report.service';

export const PROFIT_TAB = 0;
// Cash flow sits second, next to profit: the two answer the paired questions of what the business
// earned and what it actually collected, and reading one usually prompts the other.
export const CASH_FLOW_TAB = 1;
export const STOCK_TAB = 2;
export const LOSSES_TAB = 3;
export const DUE_TAB = 4;

const TAB_COUNT = 5;

/** Which half of a tab is on screen; the two never share the vertical space any more. */
export type ReportView = 'chart' | 'table';

/**
 * The windows the period toggles offer. One type for both tabs: they present the same four
 * choices, and only the date each tab's endpoint compares against differs - payment dates for
 * cash flow, booking dates for profit.
 */
export type ReportPeriod = 'd30' | 'd90' | 'year' | 'all';

const PERIOD_DAYS: Record<'d30' | 'd90', number> = { d30: 30, d90: 90 };

const PERIODS: readonly ReportPeriod[] = ['d30', 'd90', 'year', 'all'];

/**
 * Four-tab detail view over the reporting endpoints, each tab switching between its chart and its
 * sortable table. The dashboard stays the at-a-glance summary; this page is where the full figures
 * live, which is why the table here is exhaustive and exportable while the chart is a top ten.
 */
@Component({
  selector: 'app-reports-page',
  imports: [
    ChartComponent,
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    RouterLink,
    TranslatePipe
  ],
  templateUrl: './reports-page.component.html',
  styleUrl: './reports-page.component.scss'
})
export class ReportsPageComponent implements OnInit {
  private readonly reports = inject(ReportService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly downloadCsvFile = inject(CSV_DOWNLOADER);

  protected readonly profitColumns = ['name', 'sku', 'revenue', 'cost', 'grossProfit'];
  protected readonly supplierColumns = ['name', 'revenue', 'cost', 'grossProfit'];
  protected readonly stockColumns = ['name', 'sku', 'soldUnits', 'soldRevenue', 'inStockUnits', 'inStockValue'];
  protected readonly lossColumns = ['name', 'sku', 'lostUnits', 'destroyedUnits', 'lossValue'];
  protected readonly cashFlowColumns = ['name', 'sku', 'inflow', 'outflow', 'net'];

  protected readonly selectedTab = signal(PROFIT_TAB);

  // One entry per tab so a chosen view survives leaving the tab and coming back; charts open
  // first because the chart is what the page is scanned for.
  private readonly views = signal<ReportView[]>(Array<ReportView>(TAB_COUNT).fill('chart'));

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly profitRows = signal<ProductProfitReport[]>([]);
  protected readonly supplierRows = signal<SupplierProfitReport[]>([]);
  protected readonly stockRows = signal<StockStatusReport[]>([]);
  protected readonly lossRows = signal<LossReport[]>([]);
  protected readonly buckets = signal<DueDateBucket[]>([]);
  protected readonly dueSoonRows = signal<InvoiceDueSummary[]>([]);
  protected readonly overdueRows = signal<InvoiceDueSummary[]>([]);
  protected readonly cashFlow = signal<CashFlowReport | null>(null);

  // Presets rather than a date picker is a deliberate scope decision; a custom range is backlog.
  // One signal per tab rather than one shared: the two answer different questions, and a period
  // chosen for cash flow is not a period the reader asked profit for.
  protected readonly cashFlowPeriod = signal<ReportPeriod>('all');
  protected readonly profitPeriod = signal<ReportPeriod>('all');

  protected readonly marginOption = signal<ChartOption | null>(null);
  protected readonly profitOption = signal<ChartOption | null>(null);
  protected readonly stockOption = signal<ChartOption | null>(null);
  protected readonly lossOption = signal<ChartOption | null>(null);
  protected readonly dueOption = signal<ChartOption | null>(null);
  protected readonly cashFlowOption = signal<ChartOption | null>(null);

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
  }

  /** Exports the profit table as displayed, without the deleted marker the column renders. */
  protected exportProfit(): void {
    this.exportCsv(
      'profit-products.csv',
      this.profitColumns,
      this.profitRows().map((row) => [row.name, row.sku, row.revenue, row.cost, row.grossProfit])
    );
  }

  protected exportSuppliers(): void {
    this.exportCsv(
      'profit-suppliers.csv',
      this.supplierColumns,
      this.supplierRows().map((row) => [row.name, row.revenue, row.cost, row.grossProfit])
    );
  }

  protected exportStock(): void {
    this.exportCsv(
      'stock-status.csv',
      this.stockColumns,
      this.stockRows().map((row) => [
        row.name,
        row.sku,
        row.soldUnits,
        row.soldRevenue,
        row.inStockUnits,
        row.inStockValue
      ])
    );
  }

  protected exportLosses(): void {
    this.exportCsv(
      'losses.csv',
      this.lossColumns,
      this.lossRows().map((row) => [
        row.name,
        row.sku,
        row.lostUnits,
        row.destroyedUnits,
        row.lossValue
      ])
    );
  }

  /** Switches the profit window and refetches both profit queries, which share the one period. */
  protected setProfitPeriod(period: ReportPeriod): void {
    // Same two guards as the cash-flow toggle: the group emits once with no value while it is
    // being created, and re-picking the current preset is no reason to go back to the server.
    if (!PERIODS.includes(period) || period === this.profitPeriod()) {
      return;
    }
    this.profitPeriod.set(period);
    this.loadProfit();
  }

  /** Switches the cash-flow window and refetches, since the period is a server-side filter. */
  protected setCashFlowPeriod(period: ReportPeriod): void {
    // Two reasons to ignore an emission. The group fires once with no value at all while it is
    // being created, and these tab bodies are built eagerly, so an unguarded handler would query
    // cash flow - over a nonsense window - before the tab was ever opened. Re-picking the current
    // preset is likewise not a reason to go back to the server.
    if (!PERIODS.includes(period) || period === this.cashFlowPeriod()) {
      return;
    }
    this.cashFlowPeriod.set(period);
    this.loadCashFlow();
  }

  protected exportCashFlow(): void {
    this.exportCsv(
      'cash-flow.csv',
      this.cashFlowColumns,
      (this.cashFlow()?.products ?? []).map((row) => [row.name, row.sku, row.inflow, row.outflow, row.net]),
      'reports.cashFlow.columns.'
    );
  }

  protected sortProfit(sort: Sort): void {
    this.profitRows.update((rows) => sortRows(rows, sort));
  }

  protected sortSuppliers(sort: Sort): void {
    this.supplierRows.update((rows) => sortRows(rows, sort));
  }

  protected sortStock(sort: Sort): void {
    this.stockRows.update((rows) => sortRows(rows, sort));
  }

  protected sortLosses(sort: Sort): void {
    this.lossRows.update((rows) => sortRows(rows, sort));
  }

  /** Fetches the row's own detail before opening the dialog, which is a pure presenter. */
  protected openDetail(row: ProductProfitReport): void {
    // The tab's active period, so the dialog never contradicts the table row that opened it.
    const range = periodRange(this.profitPeriod());

    this.reports.profitProductDetail(row.productId, range.from, range.to).subscribe({
      next: (detail) => this.dialog.open(ProfitDetailDialogComponent, { data: detail }),
      error: (err: Error) => this.error.set(err.message)
    });
  }

  private loadTab(index: number): void {
    this.error.set(null);
    this.loading.set(true);

    switch (index) {
      case CASH_FLOW_TAB:
        return this.loadCashFlow();
      case STOCK_TAB:
        return this.loadStock();
      case LOSSES_TAB:
        return this.loadLosses();
      case DUE_TAB:
        return this.loadDue();
      default:
        return this.loadProfit();
    }
  }

  private loadProfit(): void {
    this.error.set(null);
    this.loading.set(true);
    // Both queries take the same window: a chart filtered to a period beside a supplier table that
    // was not would be worse than no filter at all.
    const range = periodRange(this.profitPeriod());

    this.reports.profitProducts(range.from, range.to).subscribe({
      next: (rows) => {
        this.profitRows.set(rows);
        // The gauge is derived from these rows rather than fetched, so the period reaches it with
        // no work of its own - refetching the rows is what re-answers it for the new window.
        this.marginOption.set(toMarginOption(rows));
        // Translated at build time: chart options are snapshots, as everywhere else on this page.
        this.profitOption.set(toProfitOption(rows, this.otherLabel()));
        this.loading.set(false);
      },
      error: (err: Error) => this.fail(err)
    });

    this.reports.profitSuppliers(range.from, range.to).subscribe({
      next: (rows) => this.supplierRows.set(rows),
      error: (err: Error) => this.fail(err)
    });
  }

  private loadStock(): void {
    this.reports.stockStatus().subscribe({
      next: (rows) => {
        this.stockRows.set(rows);
        this.stockOption.set(toStockOption(rows, this.otherLabel()));
        this.loading.set(false);
      },
      error: (err: Error) => this.fail(err)
    });
  }

  private loadLosses(): void {
    this.reports.losses().subscribe({
      next: (rows) => {
        this.lossRows.set(rows);
        this.lossOption.set(toLossOption(rows, this.otherLabel()));
        this.loading.set(false);
      },
      error: (err: Error) => this.fail(err)
    });
  }

  private loadDue(): void {
    this.reports.dueDates().subscribe({
      next: (rows) => {
        this.buckets.set(rows);
        this.dueOption.set(toDueOption(rows));
        this.loading.set(false);
      },
      error: (err: Error) => this.fail(err)
    });

    this.reports.dueSoon().subscribe({
      next: (rows) => this.dueSoonRows.set(rows),
      error: (err: Error) => this.fail(err)
    });

    this.reports.overdue().subscribe({
      next: (rows) => this.overdueRows.set(rows),
      error: (err: Error) => this.fail(err)
    });
  }

  private loadCashFlow(): void {
    this.error.set(null);
    this.loading.set(true);
    const range = periodRange(this.cashFlowPeriod());

    this.reports.cashFlow(range.from, range.to).subscribe({
      next: (report) => {
        this.cashFlow.set(report);
        // Translated at build time: chart options are snapshots, as everywhere else on this page.
        this.cashFlowOption.set(toCashFlowOption(report, this.otherLabel()));
        this.loading.set(false);
      },
      error: (err: Error) => this.fail(err)
    });
  }

  private otherLabel(): string {
    return this.translate.instant('charts.other') as string;
  }

  /** Headers and separators are resolved at click time, so the file matches the UI language. */
  private exportCsv(
    filename: string,
    columns: string[],
    rows: (string | number | null)[][],
    keyPrefix = 'reports.columns.'
  ): void {
    const headers = columns.map((column) =>
      this.translate.instant(`${keyPrefix}${column}`)
    ) as string[];
    this.downloadCsvFile(filename, buildCsv(headers, rows, this.language.currentLang()));
  }

  /** Backend messages have no i18n, so they are surfaced verbatim as elsewhere in the app. */
  private fail(err: Error): void {
    this.loading.set(false);
    this.error.set(err.message);
  }
}

/**
 * Builds the overall-margin gauge, or null when there is no revenue to divide by. Returning
 * null rather than a zero gauge keeps a NaN off the dial and lets the template show the empty
 * state instead. Display-only arithmetic over server-authoritative figures, as with the
 * invoice totals.
 */
function toMarginOption(rows: ProductProfitReport[]): ChartOption | null {
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  if (revenue === 0) {
    return null;
  }
  const profit = rows.reduce((sum, row) => sum + row.grossProfit, 0);
  const margin = Math.round((profit / revenue) * 1000) / 10;

  return {
    series: [
      {
        type: 'gauge',
        min: 0,
        max: 100,
        // Bands read low-to-high against the same thresholds a reader would apply by eye.
        axisLine: { lineStyle: { width: 14, color: [[0.2, '#d9534f'], [0.5, '#f0ad4e'], [1, '#5cb85c']] } },
        detail: { formatter: '{value}%', fontSize: 22 },
        data: [{ value: margin }]
      }
    ]
  };
}

/**
 * Turns a preset into the ISO bounds the endpoints take, or no bounds at all for the open window.
 * Computed from the browser's date because the presets describe the operator's calendar, and both
 * backends compare against a date rather than a timestamp. Shared by the profit and cash-flow
 * tabs: two copies of this arithmetic would be two chances to drift apart.
 */
function periodRange(period: ReportPeriod): { from?: string; to?: string } {
  if (period === 'all') {
    return {};
  }
  const today = new Date();
  if (period === 'year') {
    return { from: isoDate(new Date(today.getFullYear(), 0, 1)), to: isoDate(today) };
  }
  const start = new Date(today);
  start.setDate(start.getDate() - PERIOD_DAYS[period]);
  return { from: isoDate(start), to: isoDate(today) };
}

/** Local calendar date in the YYYY-MM-DD shape the API takes; UTC would shift the boundary. */
function isoDate(value: Date): string {
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

/**
* Plots net cash flow for the ten products that moved the most money, either direction, plus the
* aggregated rest. Net rather than the two gross figures: one bar per product answers "did this
* product bring money in or take it out", which is the question the tab exists for.
*/
function toCashFlowOption(report: CashFlowReport, otherLabel: string): ChartOption | null {
  if (report.products.length === 0) {
    return null;
  }
  const ordered = topNWithRemainder(
    report.products.map((row) => ({ name: row.name, value: row.net })),
    otherLabel
  ).sort((a, b) => a.value - b.value);

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 24, top: 8, bottom: 24, containLabel: true },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: ordered.map((slice) => slice.name) },
    series: [{ type: 'bar', data: ordered.map((slice) => slice.value) }]
  };
}

/**
 * Plots the ten largest contributors plus the aggregated rest. What separates this page from the
 * dashboard is the exhaustive table behind the toggle, not an unabridged chart, which stopped
 * being readable the moment the inventory outgrew the seeded dataset.
 */
function toProfitOption(rows: ProductProfitReport[], otherLabel: string): ChartOption | null {
  if (rows.length === 0) {
    return null;
  }
  const ordered = topNWithRemainder(
    rows.map((row) => ({ name: row.name, value: row.grossProfit })),
    otherLabel
  ).sort((a, b) => a.value - b.value);

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 24, top: 8, bottom: 24, containLabel: true },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: ordered.map((slice) => slice.name) },
    series: [{ type: 'bar', data: ordered.map((slice) => slice.value) }]
  };
}

function toStockOption(rows: StockStatusReport[], otherLabel: string): ChartOption | null {
  if (rows.length === 0) {
    return null;
  }
  // Reversed because a category axis draws its first entry at the bottom.
  const ordered = topNWithRemainder(
    rows.map((row) => ({ name: row.name, value: row.inStockValue })),
    otherLabel
  ).reverse();

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 24, top: 8, bottom: 24, containLabel: true },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: ordered.map((slice) => slice.name) },
    series: [{ type: 'bar', data: ordered.map((slice) => slice.value) }]
  };
}

/**
 * Builds the loss-share pie, or null when nothing has actually been written off. A pie of
 * zero-valued slices draws no arcs at all, so the empty state is the honest rendering.
 */
function toLossOption(rows: LossReport[], otherLabel: string): ChartOption | null {
  const slices = rows.filter((row) => row.lossValue > 0);
  if (slices.length === 0) {
    return null;
  }

  return {
    tooltip: { trigger: 'item' },
    legend: { type: 'scroll', bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['35%', '65%'],
        data: topNWithRemainder(
          slices.map((row) => ({ name: row.name, value: row.lossValue })),
          otherLabel
        )
      }
    ]
  };
}

/**
 * Builds the due-date area chart with one series per invoice type. Due dates are the only
 * genuine time axis the reporting API offers, which is why this is the page's one line chart.
 */
function toDueOption(buckets: DueDateBucket[]): ChartOption | null {
  if (buckets.length === 0) {
    return null;
  }
  const dates = [...new Set(buckets.map((bucket) => bucket.dueDate))].sort();
  const types = [...new Set(buckets.map((bucket) => bucket.invoiceType))].sort();

  return {
    tooltip: { trigger: 'axis' },
    // The legend sits below the axis rather than floating over it: with containLabel the grid's
    // bottom inset has to cover the date labels AND the legend row, which the previous 24px did
    // not, so the two drew on top of each other at both chart heights.
    legend: { bottom: 0 },
    grid: { left: 8, right: 24, top: 32, bottom: 48, containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: dates },
    yAxis: { type: 'value' },
    series: types.map((type) => ({
      name: type,
      type: 'line' as const,
      areaStyle: {},
      data: dates.map((date) => valueOf(buckets, date, type))
    }))
  };
}

function valueOf(buckets: DueDateBucket[], date: string, type: string): number {
  const match = buckets.find((bucket) => bucket.dueDate === date && bucket.invoiceType === type);
  return match ? match.totalValue : 0;
}

/** Sorts in the component rather than through MatTableDataSource, whose MatSort wiring would
 * race the lazily rendered tabs. */
function sortRows<T>(rows: T[], sort: Sort): T[] {
  if (!sort.active || sort.direction === '') {
    return rows;
  }
  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...rows].sort((left, right) => {
    const a = (left as Record<string, unknown>)[sort.active];
    const b = (right as Record<string, unknown>)[sort.active];
    if (typeof a === 'number' && typeof b === 'number') {
      return (a - b) * factor;
    }
    return String(a).localeCompare(String(b)) * factor;
  });
}
