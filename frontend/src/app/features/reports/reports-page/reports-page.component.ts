import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  CashFlowReport,
  CashFlowTimelineBucket,
  ChangeLogEntryResponse,
  ChangeLogResponse,
  DueDateBucket,
  InvoiceDueSummary,
  LossReport,
  ProductProfitReport,
  ProductResponse,
  StockHistoryPoint,
  StockStatusReport,
  SupplierProfitReport
} from '../../../core/api/api-models';
import { LanguageService } from '../../../core/i18n/language.service';
import { topNWithRemainder } from '../../../shared/chart/chart-data';
import { ChartComponent, ChartOption } from '../../../shared/chart/chart.component';
import { CSV_DOWNLOADER, buildCsv } from '../../../shared/csv/csv-export';
import { ProfitDetailDialogComponent } from '../profit-detail-dialog/profit-detail-dialog.component';
import { AuditService } from '../../audit/audit.service';
import { ProductService } from '../../products/product.service';
import { ReportService } from '../report.service';

export const PROFIT_TAB = 0;
// Cash flow sits second, next to profit: the two answer the paired questions of what the business
// earned and what it actually collected, and reading one usually prompts the other.
export const CASH_FLOW_TAB = 1;
export const STOCK_TAB = 2;
export const LOSSES_TAB = 3;
export const DUE_TAB = 4;
// Last, and appended rather than slotted in: the audit trail answers a different kind of question
// from the five figures before it, and renumbering them would touch every tab's tests to say so.
export const CHANGES_TAB = 5;
// Appended last for the same reason the changes tab was: it asks about one product rather than the
// whole business, and renumbering the six before it would touch every tab's tests to say so.
export const ANALYTICS_TAB = 6;

const TAB_COUNT = 7;

/** Sentinel for the changes tab's user select; no account can collide with it. */
const ALL_USERS = '';

/** Which half of a tab is on screen; the two never share the vertical space any more. */
export type ReportView = 'chart' | 'table';

/**
 * The windows the period toggles offer. One type for both tabs: they present the same choices,
 * and only the date each tab's endpoint compares against differs - payment dates for cash flow,
 * booking dates for profit.
 */
export type ReportPeriod = 'd30' | 'd90' | 'd180' | 'year' | 'all';

const PERIOD_DAYS: Record<'d30' | 'd90' | 'd180', number> = { d30: 30, d90: 90, d180: 180 };

const PERIODS: readonly ReportPeriod[] = ['d30', 'd90', 'd180', 'year', 'all'];

/**
 * Detail view over the reporting endpoints, each tab switching between its chart and its sortable
 * table. The dashboard stays the at-a-glance summary; this page is where the full figures live,
 * which is why the tables here are exhaustive and exportable while the charts are a top ten.
 *
 * <p>The changes tab is the one exception, and reads the audit module rather than the reporting
 * one: it lists events rather than figures, so it has a table and no chart.
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
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
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
  // Cross-feature, as the dashboard reads the reporting client: the change log belongs to the audit
  // module, and a report over it consumes that module's API rather than copying its endpoint.
  private readonly audit = inject(AuditService);
  // The analytics picker needs the catalogue, which the movement form reads the same way.
  private readonly products = inject(ProductService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly downloadCsvFile = inject(CSV_DOWNLOADER);

  protected readonly profitColumns = ['name', 'sku', 'revenue', 'cost', 'grossProfit'];
  protected readonly supplierColumns = ['name', 'revenue', 'cost', 'grossProfit'];
  protected readonly stockColumns = ['name', 'sku', 'soldUnits', 'soldRevenue', 'inStockUnits', 'inStockValue'];
  protected readonly lossColumns = ['name', 'sku', 'lostUnits', 'destroyedUnits', 'lossValue'];
  protected readonly cashFlowColumns = ['name', 'sku', 'inflow', 'outflow', 'net'];
  protected readonly changeColumns = ['time', 'user', 'product', 'field', 'oldValue', 'newValue'];

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
  protected readonly cashFlowMonths = signal<CashFlowTimelineBucket[]>([]);

  /**
   * Free-text narrowing of the per-product table by name or SKU.
   *
   * <p>Supplier is deliberately not a filter dimension here. Attributing cash to a supplier means
   * deciding how a product bought from several of them splits, which is the same allocation question
   * the supplier-profit report documents as unsolved (ADR 024) - it belongs to the supplier
   * traceability design, not to a text box.
   */
  protected readonly cashFlowFilter = signal('');

  protected readonly cashFlowRows = computed(() =>
    matchingNameOrSku(this.cashFlow()?.products ?? [], this.cashFlowFilter())
  );

  /** The same narrowing on the stock and loss tables; the question a reader asks of a product
   *  list does not change with which report they are reading. */
  protected readonly stockFilter = signal('');
  protected readonly lossFilter = signal('');

  protected readonly filteredStockRows = computed(() =>
    matchingNameOrSku(this.stockRows(), this.stockFilter())
  );

  protected readonly filteredLossRows = computed(() =>
    matchingNameOrSku(this.lossRows(), this.lossFilter())
  );

  /**
   * The stock tab's headline figures, summed from the rows the tab already loaded.
   *
   * <p>Derived rather than fetched, so a single source answers both halves of the tab: a strip and
   * the table beneath it cannot disagree when the strip is the table added up. The unfiltered rows
   * on purpose - the strip states what the business holds, which a text box must not appear to
   * change.
   */
  protected readonly stockTotals = computed(() => {
    const rows = this.stockRows();
    if (rows.length === 0) {
      return null;
    }
    return {
      value: rows.reduce((sum, row) => sum + row.inStockValue, 0),
      units: rows.reduce((sum, row) => sum + row.inStockUnits, 0),
      products: rows.length
    };
  });

  /** The losses tab's headline figures, on the same derivation and the same unfiltered basis. */
  protected readonly lossTotals = computed(() => {
    const rows = this.lossRows();
    if (rows.length === 0) {
      return null;
    }
    return {
      value: rows.reduce((sum, row) => sum + row.lossValue, 0),
      lost: rows.reduce((sum, row) => sum + row.lostUnits, 0),
      destroyed: rows.reduce((sum, row) => sum + row.destroyedUnits, 0)
    };
  });

  /**
   * The totals strip, summed from the monthly buckets.
   *
   * <p>Same figures the per-product report reports: both endpoints aggregate the same paid lines
   * through one shared SQL fragment and differ only in what they group by, so a month total and a
   * product total can never disagree. Reading them from the timeline is what lets the per-product
   * call stay lazy without the strip going blank on the chart view.
   */
  protected readonly cashFlowTotals = computed(() => {
    const months = this.cashFlowMonths();
    if (months.length === 0) {
      return null;
    }
    const inflow = months.reduce((sum, month) => sum + month.inflow, 0);
    const outflow = months.reduce((sum, month) => sum + month.outflow, 0);
    return { inflow, outflow, net: inflow - outflow };
  });

  // Presets rather than a date picker is a deliberate scope decision; a custom range is backlog.
  // One signal per tab rather than one shared: the two answer different questions, and a period
  // chosen for cash flow is not a period the reader asked profit for.
  protected readonly cashFlowPeriod = signal<ReportPeriod>('all');
  protected readonly profitPeriod = signal<ReportPeriod>('all');
  protected readonly lossPeriod = signal<ReportPeriod>('all');
  protected readonly changePeriod = signal<ReportPeriod>('all');
  protected readonly analyticsPeriod = signal<ReportPeriod>('all');

  /**
   * The product the analytics tab is charting, or null until one is chosen.
   *
   * <p>Nothing is preselected: the first product in the catalogue is not a meaningful default, and
   * a chart of it would read as an answer to a question nobody asked.
   */
  protected readonly analyticsProductId = signal<number | null>(null);

  /**
   * The whole catalogue, for the picker.
   *
   * <p>The full list at demo scale; the product search endpoint is the path if a catalogue ever
   * outgrows a select. Loaded from the same service call the movement form's picker uses.
   */
  protected readonly analyticsProducts = signal<ProductResponse[]>([]);

  protected readonly stockHistory = signal<StockHistoryPoint[]>([]);
  protected readonly priceHistory = signal<PricePoint[]>([]);

  protected readonly analyticsStockOption = signal<ChartOption | null>(null);
  protected readonly analyticsPriceOption = signal<ChartOption | null>(null);

  protected readonly changeRows = signal<ChangeLogEntryResponse[]>([]);

  /**
   * Narrowing by the person who made the change.
   *
   * <p>The options come from the loaded rows rather than from a user directory. A listing of
   * accounts would be a second endpoint, a second authorization question and a list dominated by
   * people who have changed nothing - and this demo has two actors. The rows already name everyone
   * who appears in them, which is exactly the set worth offering.
   */
  protected readonly changeUser = signal(ALL_USERS);
  protected readonly changeFilter = signal('');

  protected readonly changeUsernames = computed(() =>
    [...new Set(this.changeRows().map((row) => row.username))].sort()
  );

  protected readonly filteredChangeRows = computed(() => {
    const user = this.changeUser();
    const byUser = user === ALL_USERS
      ? this.changeRows()
      : this.changeRows().filter((row) => row.username === user);
    // The row's product is what the text filter reads, so the shared predicate needs it named
    // the way every other table names it.
    const needle = this.changeFilter().trim().toLowerCase();
    if (!needle) {
      return byUser;
    }
    return byUser.filter(
      (row) => row.productName.toLowerCase().includes(needle) || row.sku.toLowerCase().includes(needle)
    );
  });

  protected readonly marginOption = signal<ChartOption | null>(null);
  protected readonly profitOption = signal<ChartOption | null>(null);
  protected readonly stockOption = signal<ChartOption | null>(null);
  protected readonly lossOption = signal<ChartOption | null>(null);
  protected readonly dueOption = signal<ChartOption | null>(null);
  protected readonly cashFlowOption = signal<ChartOption | null>(null);

  // Loading every tab on open would fire eight report queries against aggregate SQL for tabs the
  // user may never look at, so each tab fetches on its first activation only.
  private readonly loadedTabs = new Set<number>();

  // Guards the fetch rather than the rows, as the dashboard's due card does: the per-product
  // breakdown is only ever on screen in the table half, and a reader who never opens it should not
  // pay for the query.
  private cashFlowProductsLoaded = false;

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
    if (tab === CASH_FLOW_TAB && view === 'table' && !this.cashFlowProductsLoaded) {
      this.loadCashFlowProducts();
    }
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
      // The filtered rows, as on the cash-flow tab: the export mirrors what the user is looking at.
      this.filteredStockRows().map((row) => [
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
      this.filteredLossRows().map((row) => [
        row.name,
        row.sku,
        row.lostUnits,
        row.destroyedUnits,
        row.lossValue
      ])
    );
  }

  protected setStockFilter(value: string): void {
    this.stockFilter.set(value);
  }

  protected setLossFilter(value: string): void {
    this.lossFilter.set(value);
  }

  protected setChangeFilter(value: string): void {
    this.changeFilter.set(value);
  }

  protected setChangeUser(value: string): void {
    this.changeUser.set(value);
  }

  protected setAnalyticsProduct(productId: number): void {
    this.analyticsProductId.set(productId);
    this.loadAnalytics();
  }

  /** Switches the analytics window and refetches both series over the chosen product. */
  protected setAnalyticsPeriod(period: ReportPeriod): void {
    // Same two guards as every other preset group on this page.
    if (!PERIODS.includes(period) || period === this.analyticsPeriod()) {
      return;
    }
    this.analyticsPeriod.set(period);
    if (this.analyticsProductId() !== null) {
      this.loadAnalytics();
    }
  }

  /** Switches the changes window and refetches, since the period is a server-side filter. */
  protected setChangePeriod(period: ReportPeriod): void {
    // Same two guards as every other preset group on this page.
    if (!PERIODS.includes(period) || period === this.changePeriod()) {
      return;
    }
    this.changePeriod.set(period);
    this.loadChanges();
  }

  protected exportChanges(): void {
    this.exportCsv(
      'changes.csv',
      this.changeColumns,
      // Every active narrowing at once: the period is already in the data, and the user and text
      // filters are applied here, so the download says what the screen says.
      this.filteredChangeRows().map((row) => [
        row.createdAt,
        row.username,
        row.productName,
        this.translate.instant('audit.field.' + row.field) as string,
        row.oldValue,
        row.newValue
      ]),
      'reports.changes.columns.'
    );
  }

  /** Switches the loss window and refetches, since the period is a server-side filter. */
  protected setLossPeriod(period: ReportPeriod): void {
    // Same two guards as the other toggles: the group emits once with no value while it is being
    // created, and re-picking the current preset is no reason to go back to the server.
    if (!PERIODS.includes(period) || period === this.lossPeriod()) {
      return;
    }
    this.lossPeriod.set(period);
    this.loadLosses();
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

  protected setCashFlowFilter(value: string): void {
    this.cashFlowFilter.set(value);
  }

  protected exportCashFlow(): void {
    this.exportCsv(
      'cash-flow.csv',
      this.cashFlowColumns,
      // The filtered rows, not all of them: the export mirrors what the user is looking at, so a
      // narrowed table and its download tell the same story.
      this.cashFlowRows().map((row) => [row.name, row.sku, row.inflow, row.outflow, row.net]),
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
      case CHANGES_TAB:
        return this.loadChanges();
      case ANALYTICS_TAB:
        return this.loadAnalytics();
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

  /** Loads only the picker; the charts wait for a product, because there is nothing to chart yet. */
  private loadAnalytics(): void {
    this.error.set(null);
    if (this.analyticsProducts().length === 0) {
      this.products.getAll().subscribe({
        next: (rows) => this.analyticsProducts.set(rows),
        error: (err: Error) => this.fail(err)
      });
    }

    const productId = this.analyticsProductId();
    if (productId === null) {
      return;
    }
    this.loading.set(true);
    const range = periodRange(this.analyticsPeriod());

    this.reports.stockHistory(productId, range.from, range.to).subscribe({
      next: (points) => {
        this.stockHistory.set(points);
        // Translated at build time: chart options are snapshots, as everywhere else on this page.
        this.analyticsStockOption.set(toStockHistoryOption(points, {
          stock: this.translate.instant('reports.analytics.stockLevel') as string,
          sold: this.translate.instant('reports.analytics.soldUnits') as string
        }));
        this.loading.set(false);
      },
      error: (err: Error) => this.fail(err)
    });

    // The price series comes from the audit trail rather than a reporting endpoint: a price change
    // is something a person did, and the change log is where that already lives.
    this.audit.productChanges(productId).subscribe({
      next: (rows) => {
        const points = toPricePoints(rows, range);
        this.priceHistory.set(points);
        this.analyticsPriceOption.set(toPriceHistoryOption(points));
      },
      error: (err: Error) => this.fail(err)
    });
  }

  private loadChanges(): void {
    this.error.set(null);
    this.loading.set(true);
    const range = periodRange(this.changePeriod());

    this.audit.changes(range.from, range.to).subscribe({
      next: (rows) => {
        this.changeRows.set(rows);
        // The user options derive from these rows, so a narrower period can retire the account the
        // select is sitting on; falling back to all beats filtering against a name that is gone.
        if (!rows.some((row) => row.username === this.changeUser())) {
          this.changeUser.set(ALL_USERS);
        }
        this.loading.set(false);
      },
      error: (err: Error) => this.fail(err)
    });
  }

  private loadLosses(): void {
    this.error.set(null);
    this.loading.set(true);
    const range = periodRange(this.lossPeriod());

    this.reports.losses(range.from, range.to).subscribe({
      next: (rows) => {
        this.lossRows.set(rows);
        // The strip is derived from these rows, so refetching them is what re-answers it for the
        // new window - the period reaches the totals with no work of its own.
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

    this.reports.cashFlowTimeline(range.from, range.to).subscribe({
      next: (months) => {
        this.cashFlowMonths.set(months);
        // Translated at build time: chart options are snapshots, as everywhere else on this page.
        this.cashFlowOption.set(toCashFlowOption(months, this.cashFlowLabels()));
        this.loading.set(false);
      },
      error: (err: Error) => this.fail(err)
    });

    // Only when the reader has already opened the table; otherwise the first switch fetches it.
    if (this.cashFlowProductsLoaded) {
      this.loadCashFlowProducts();
    }
  }

  private loadCashFlowProducts(): void {
    this.cashFlowProductsLoaded = true;
    const range = periodRange(this.cashFlowPeriod());

    this.reports.cashFlow(range.from, range.to).subscribe({
      next: (report) => this.cashFlow.set(report),
      error: (err: Error) => this.fail(err)
    });
  }

  /** The three series names, resolved at build time like every other chart label on this page. */
  private cashFlowLabels(): CashFlowLabels {
    return {
      inflow: this.translate.instant('reports.cashFlow.inflow') as string,
      outflow: this.translate.instant('reports.cashFlow.outflow') as string,
      net: this.translate.instant('reports.cashFlow.net') as string
    };
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

/** One purchase price and the day it took effect. */
interface PricePoint {
  date: string;
  price: number;
}

/**
 * Turns change-log rows into the price series, keeping only what can actually be plotted.
 *
 * <p>Rows whose new value will not parse as a number are skipped rather than plotted as zero or
 * NaN. The log stores values as free text by design - that is what lets a new loggable field need
 * no schema change - so a non-numeric value here is a correctly recorded change of something that
 * is not a price, not corruption.
 *
 * <p>The window is applied here rather than by the endpoint: the per-product change listing takes
 * no period, and asking for one would widen an API two other screens already depend on.
 */
function toPricePoints(rows: ChangeLogResponse[], range: { from?: string; to?: string }): PricePoint[] {
  return rows
    .filter((row) => row.field === 'PURCHASE_PRICE')
    .filter((row) => (!range.from || row.createdAt >= range.from)
      && (!range.to || row.createdAt <= `${range.to}T23:59:59`))
    .map((row) => ({ date: row.createdAt.slice(0, 10), price: Number(row.newValue) }))
    .filter((point) => Number.isFinite(point.price))
    // The listing arrives newest first; a time axis reads the other way.
    .reverse();
}

/**
 * Plots the purchase price as a step line: a price holds until it is changed, so the sloped line an
 * ordinary series would draw between two points would show prices that were never charged.
 *
 * <p>Null below two points: one price is a fact, not a history, and a single-point line renders as
 * an empty plot area that looks broken. The template shows the no-changes state instead.
 */
function toPriceHistoryOption(points: PricePoint[]): ChartOption | null {
  if (points.length < 2) {
    return null;
  }

  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 24, top: 16, bottom: 24, containLabel: true },
    xAxis: { type: 'category', data: points.map((point) => point.date) },
    yAxis: { type: 'value' },
    series: [{ type: 'line', step: 'end', data: points.map((point) => point.price) }]
  };
}

/**
 * Plots stock level against cumulative units sold over the days a product moved.
 *
 * <p>The stock series steps and the sales series does not, and the difference is the point: stock
 * holds its level between movements, while cumulative sales are a total that only ever grows. The
 * two together answer which products sell and which sit.
 */
function toStockHistoryOption(
  points: StockHistoryPoint[],
  labels: { stock: string; sold: string }
): ChartOption | null {
  if (points.length === 0) {
    return null;
  }

  return {
    tooltip: { trigger: 'axis' },
    // Same inset as the other legended charts: the bottom has to clear the date labels and the
    // legend row, which a smaller value lets draw over each other.
    legend: { bottom: 0 },
    grid: { left: 8, right: 24, top: 32, bottom: 48, containLabel: true },
    xAxis: { type: 'category', data: points.map((point) => point.date) },
    yAxis: { type: 'value' },
    series: [
      { name: labels.stock, type: 'line', step: 'end', data: points.map((point) => point.stockLevel) },
      { name: labels.sold, type: 'line', data: points.map((point) => point.cumulativeSoldUnits) }
    ]
  };
}

/**
 * Narrows report rows to those whose name or SKU contains {@code needle}, ignoring case.
 *
 * <p>One predicate for all three filtered tables. They ask the reader the same question, so three
 * copies would only be three chances for them to start answering it differently.
 */
function matchingNameOrSku<T extends { name: string; sku: string }>(rows: T[], needle: string): T[] {
  const term = needle.trim().toLowerCase();
  if (!term) {
    return rows;
  }
  return rows.filter(
    (row) => row.name.toLowerCase().includes(term) || row.sku.toLowerCase().includes(term)
  );
}

/** Local calendar date in the YYYY-MM-DD shape the API takes; UTC would shift the boundary. */
function isoDate(value: Date): string {
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

/** The three translated series names the cash-flow chart labels its legend with. */
interface CashFlowLabels {
  inflow: string;
  outflow: string;
  net: string;
}

/**
 * Plots money in and out per month, with the running net as a line over the two bars.
 *
 * <p>A timeline rather than a bar per product: cash flow is a question about when money moved, and
 * the per-product breakdown that used to be drawn here answers a different one - which is why it now
 * lives in the table half, where a reader can filter and export it.
 *
 * <p>The months are drawn exactly as delivered. The endpoint omits months that moved no money, so
 * an idle month is a gap between categories rather than a zero column claiming activity was measured
 * and found to be nothing.
 */
function toCashFlowOption(months: CashFlowTimelineBucket[], labels: CashFlowLabels): ChartOption | null {
  if (months.length === 0) {
    return null;
  }

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    // Same inset as the due chart: with containLabel the bottom has to clear the axis labels AND
    // the legend row, which a smaller value lets the two draw on top of each other.
    legend: { bottom: 0 },
    grid: { left: 8, right: 24, top: 32, bottom: 48, containLabel: true },
    xAxis: { type: 'category', data: months.map((month) => month.month) },
    yAxis: { type: 'value' },
    series: [
      { name: labels.inflow, type: 'bar', data: months.map((month) => month.inflow) },
      { name: labels.outflow, type: 'bar', data: months.map((month) => month.outflow) },
      { name: labels.net, type: 'line', data: months.map((month) => month.net) }
    ]
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
