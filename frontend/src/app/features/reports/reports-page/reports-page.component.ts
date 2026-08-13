import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Sort } from '@angular/material/sort';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  CashFlowReport,
  CashFlowTimelineBucket,
  ChangeLogEntryResponse,
  ChangeLogResponse,
  DueDateBucket,
  InvoiceDueSummary,
  LossByRemark,
  LossReport,
  ProductProfitReport,
  StockHistoryPoint,
  SupplierProduct,
  SupplierResponse
} from '../../../core/api/api-models';
import { FormatService } from '../../../core/format/format.service';
import { topNWithRemainder } from '../../../shared/chart/chart-data';
import { bucketValueAt } from '../../../shared/chart/due-buckets';
import { ChartFormat } from '../../../shared/chart/chart-format';
import { ChartOption } from '../../../shared/chart/chart.component';
import { CsvExportService } from '../../../shared/csv/csv-export.service';
import { ProfitDetailDialogComponent } from '../profit-detail-dialog/profit-detail-dialog.component';
import { AuditService } from '../../audit/audit.service';
import { ReportService } from '../report.service';
import { SupplierService } from '../../suppliers/supplier.service';
import { AnalyticsCardComponent } from './analytics-card/analytics-card.component';
import { CashFlowCardComponent } from './cash-flow-card/cash-flow-card.component';
import { ChangesCardComponent } from './changes-card/changes-card.component';
import { DueDatesCardComponent } from './due-dates-card/due-dates-card.component';
import { LossesCardComponent } from './losses-card/losses-card.component';
import { PeriodToggleComponent, ReportPeriod } from './period-toggle/period-toggle.component';
import { ProfitCardComponent } from './profit-card/profit-card.component';
import { StockCardComponent } from './stock-card/stock-card.component';
import { SupplierProductPickerComponent } from './supplier-product-picker/supplier-product-picker.component';
import { ReportView, ReportViewToggleComponent } from './report-view-toggle/report-view-toggle.component';
import { ProfitTabState } from './profit-tab-state';
import { ReportChartContext } from './report-chart-context';
import { ReportStatus } from './report-status';
import { matchingNameOrSku, periodRange, sortRows } from './report-tab-helpers';
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

/** Sentinel for the changes tab's user select; no account can collide with it. */
const ALL_USERS = '';

const PERIODS: readonly ReportPeriod[] = ['d30', 'd90', 'd180', 'year', 'all'];

/** One purchase price and the day it took effect. */
interface PricePoint {
  date: string;
  price: number;
}

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
  providers: [ReportChartContext, ReportStatus, ProfitTabState, StockTabState]
})
export class ReportsPageComponent implements OnInit {
  protected readonly charts = inject(ReportChartContext);
  protected readonly status = inject(ReportStatus);
  protected readonly profit = inject(ProfitTabState);
  protected readonly stock = inject(StockTabState);

  private readonly reports = inject(ReportService);
  // Cross-feature, as the dashboard reads the reporting client: the change log belongs to the audit
  // module, and a report over it consumes that module's API rather than copying its endpoint.
  private readonly audit = inject(AuditService);
  // The supplier typeaheads read the supplier module's own search; the scoped product search is the
  // reporting module's, so it comes off ReportService above.
  private readonly suppliers = inject(SupplierService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly format = inject(FormatService);
  private readonly csv = inject(CsvExportService);

  protected readonly lossColumns = ['name', 'sku', 'lostUnits', 'destroyedUnits', 'lossValue'];

  protected readonly cashFlowColumns = ['name', 'sku', 'inflow', 'outflow', 'net'];
  protected readonly changeColumns = ['time', 'user', 'product', 'field', 'oldValue', 'newValue'];

  protected readonly selectedTab = signal(PROFIT_TAB);

  // One entry per tab so a chosen view survives leaving the tab and coming back; charts open
  // first because the chart is what the page is scanned for.
  // Seven entries for five readers: the changes and analytics tabs carry no view toggle, so their
  // slots are never read. Indexing by tab number is what keeps every other slot addressable by the
  // number the tab already has, and two unread booleans are cheaper than a second numbering.
  private readonly views = signal<ReportView[]>(Array<ReportView>(TAB_COUNT).fill('chart'));

  protected readonly lossRows = signal<LossReport[]>([]);
  protected readonly lossRemarkRows = signal<LossByRemark[]>([]);
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

  protected readonly lossFilter = signal('');

  protected readonly filteredLossRows = computed(() =>
    matchingNameOrSku(this.lossRows(), this.lossFilter())
  );

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
  protected readonly lossPeriod = signal<ReportPeriod>('all');
  protected readonly changePeriod = signal<ReportPeriod>('all');
  protected readonly analyticsPeriod = signal<ReportPeriod>('all');

  /**
   * The supplier each tab's product search is scoped to, and the product chosen under it.
   *
   * <p>The supplier is a navigation aid, not a query dimension. Neither tab ever sends it: it
   * decides which products the second field can offer, and nothing else. Cash flow scoped by
   * supplier would be a different report from the one this tab shows, and the analytics series are
   * a product's own history, which no supplier narrows.
   */
  protected readonly analyticsSupplier = signal<SupplierResponse | null>(null);
  protected readonly cashFlowSupplier = signal<SupplierResponse | null>(null);

  /**
   * The product the analytics tab would chart, and the one it is charting.
   *
   * <p>Two signals rather than one, because choosing is not asking. Nothing is fetched until the
   * Show button is pressed, so the tab can hold a picked product that no chart on screen reflects -
   * which is the entire point of the gate.
   */
  protected readonly analyticsProduct = signal<SupplierProduct | null>(null);
  protected readonly analyticsShownProductId = signal<number | null>(null);

  /** The product the cash-flow timeline is scoped to, or null for the whole business. */
  protected readonly cashFlowProduct = signal<SupplierProduct | null>(null);

  /** Enabled only once a product is picked; with nothing picked there is nothing to show. */
  protected readonly canShowAnalytics = computed(() => this.analyticsProduct() !== null);

  /** How a supplier and a product read in the typeahead panels. */
  protected readonly supplierLabel = (supplier: SupplierResponse): string => supplier.name;
  protected readonly productLabel = (product: SupplierProduct): string => product.name;

  /** Searches bound into the typeaheads; arrow properties so `this` survives the input binding. */
  protected readonly searchSuppliers = (term: string): Observable<SupplierResponse[]> =>
    this.suppliers.search(term);

  protected readonly searchAnalyticsProducts = (term: string): Observable<SupplierProduct[]> =>
    this.searchProductsOf(this.analyticsSupplier(), term);

  protected readonly searchCashFlowProducts = (term: string): Observable<SupplierProduct[]> =>
    this.searchProductsOf(this.cashFlowSupplier(), term);

  /** No supplier means no scope to search within, and the field is disabled in that state anyway. */
  private searchProductsOf(supplier: SupplierResponse | null, term: string): Observable<SupplierProduct[]> {
    if (supplier?.id == null) {
      return of([]);
    }
    return this.reports.supplierProducts(supplier.id, term);
  }

  protected readonly stockHistory = signal<StockHistoryPoint[]>([]);
  protected readonly priceHistory = signal<PricePoint[]>([]);

  protected readonly analyticsStockOption = computed(() =>
    toStockHistoryOption(
      this.stockHistory(),
      { stock: this.charts.context().stockLevel, sold: this.charts.context().soldUnits },
      this.charts.context().format
    )
  );

  protected readonly analyticsPriceOption = computed(() =>
    toPriceHistoryOption(this.priceHistory(), this.charts.context().format)
  );

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

  protected readonly lossOption = computed(() =>
    toLossOption(this.lossRows(), this.charts.context().other, this.charts.context().format)
  );

  protected readonly dueOption = computed(() =>
    toDueOption(this.buckets(), this.charts.context().format)
  );

  protected readonly cashFlowOption = computed(() =>
    toCashFlowOption(this.cashFlowMonths(), this.charts.context().cashFlow, this.charts.context().format)
  );

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

  protected setLossFilter(value: string): void {
    this.lossFilter.set(value);
  }

  protected setChangeFilter(value: string): void {
    this.changeFilter.set(value);
  }

  protected setChangeUser(value: string): void {
    this.changeUser.set(value);
  }

  /**
   * Narrows which products the analytics search can offer.
   *
   * <p>The picker empties the product field with it: the one that was picked came from the previous
   * supplier's catalogue, and leaving it under a field naming a different supplier would misdescribe
   * it. That reset emits null, so the product signal clears through the ordinary path rather than a
   * second one. Whatever is already charted stays on screen - the user has not asked a new question
   * yet.
   */
  protected setAnalyticsSupplier(supplier: SupplierResponse | null): void {
    this.analyticsSupplier.set(supplier);
  }

  protected setAnalyticsProduct(product: SupplierProduct | null): void {
    // Deliberately no fetch. Picking a product states what the user is interested in; the Show
    // button is where they ask for it, and until then the charts keep answering the last question.
    this.analyticsProduct.set(product);
  }

  /** The only path that fetches the two analytics series. */
  protected showAnalytics(): void {
    const product = this.analyticsProduct();
    if (product?.id == null) {
      return;
    }
    this.analyticsShownProductId.set(product.id);
    this.loadAnalytics();
  }

  /** Switches the analytics window and refetches both series over the shown product. */
  protected setAnalyticsPeriod(period: ReportPeriod): void {
    // Same two guards as every other preset group on this page.
    if (!PERIODS.includes(period) || period === this.analyticsPeriod()) {
      return;
    }
    this.analyticsPeriod.set(period);
    // Refetches without a second press of Show, and only for a product already on screen. Asking
    // for a product is a standing request: the user wants that product's history, and a period is
    // which slice of it they want to see - not a new question about a different subject.
    if (this.analyticsShownProductId() !== null) {
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
        // Through the same service the screen's column uses, so the file matches what was on
        // screen instead of shipping a raw ISO timestamp beside localized numbers.
        this.format.formatDateTime(row.createdAt),
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

  protected sortLosses(sort: Sort): void {
    this.lossRows.update((rows) => sortRows(rows, sort));
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
        return this.loadCashFlow();
      case STOCK_TAB:
        return this.stock.load();
      case LOSSES_TAB:
        return this.loadLosses();
      case DUE_TAB:
        return this.loadDue();
      case CHANGES_TAB:
        return this.loadChanges();
      case ANALYTICS_TAB:
        return this.loadAnalytics();
      default:
        return this.profit.load();
    }
  }

  /**
   * Fetches the two series for the product the user has asked to see.
   *
   * <p>Nothing is loaded when the tab opens, and no catalogue is fetched at all: the pickers query
   * as they are typed into. A tab that fetched on activation would be answering a question about a
   * product nobody had named yet.
   */
  private loadAnalytics(): void {
    this.status.error.set(null);

    const productId = this.analyticsShownProductId();
    if (productId === null) {
      // loadTab raises the bar before dispatching, because every other tab fetches something on
      // activation. This is the one tab that can decide it has nothing to fetch, so it has to lower
      // the bar again - otherwise opening it leaves an indeterminate bar running over an idle page.
      this.status.loading.set(false);
      return;
    }
    this.status.loading.set(true);
    const range = periodRange(this.analyticsPeriod());

    this.reports.stockHistory(productId, range.from, range.to).subscribe({
      next: (points) => {
        this.stockHistory.set(points);
        this.status.loading.set(false);
      },
      error: (err: Error) => this.status.fail(err)
    });

    // The price series comes from the audit trail rather than a reporting endpoint: a price change
    // is something a person did, and the change log is where that already lives.
    this.audit.productChanges(productId).subscribe({
      next: (rows) => {
        const points = toPricePoints(rows, range);
        this.priceHistory.set(points);
      },
      error: (err: Error) => this.status.fail(err)
    });
  }

  private loadChanges(): void {
    this.status.error.set(null);
    this.status.loading.set(true);
    const range = periodRange(this.changePeriod());

    this.audit.changes(range.from, range.to).subscribe({
      next: (rows) => {
        this.changeRows.set(rows);
        // The user options derive from these rows, so a narrower period can retire the account the
        // select is sitting on; falling back to all beats filtering against a name that is gone.
        if (!rows.some((row) => row.username === this.changeUser())) {
          this.changeUser.set(ALL_USERS);
        }
        this.status.loading.set(false);
      },
      error: (err: Error) => this.status.fail(err)
    });
  }

  private loadLosses(): void {
    this.status.error.set(null);
    this.status.loading.set(true);
    const range = periodRange(this.lossPeriod());

    this.reports.losses(range.from, range.to).subscribe({
      next: (rows) => {
        this.lossRows.set(rows);
        this.status.loading.set(false);
      },
      error: (err: Error) => this.status.fail(err)
    });

    // The breakdown is a second read of the same window, not a slice of the rows above: the
    // per-product response carries no remark, so the grouping cannot be derived client-side.
    // Fired alongside rather than chained, because neither answer needs the other.
    this.reports.lossesByRemark(range.from, range.to).subscribe({
      next: (rows) => this.lossRemarkRows.set(rows),
      // The tab shows one error line, and it is already the one loadLosses sets on the same
      // failure. Sharing it keeps a doubled message off the screen when the API is simply down.
      error: (err: Error) => {
        this.lossRemarkRows.set([]);
        this.status.fail(err);
      }
    });
  }

  private loadDue(): void {
    this.reports.dueDates().subscribe({
      next: (rows) => {
        this.buckets.set(rows);
        this.status.loading.set(false);
      },
      error: (err: Error) => this.status.fail(err)
    });

    this.reports.dueSoon().subscribe({
      next: (rows) => this.dueSoonRows.set(rows),
      error: (err: Error) => this.status.fail(err)
    });

    this.reports.overdue().subscribe({
      next: (rows) => this.overdueRows.set(rows),
      error: (err: Error) => this.status.fail(err)
    });
  }

  /**
   * Narrows which products the cash-flow search can offer; see {@link setAnalyticsSupplier}.
   *
   * <p>Clearing the product returns the timeline to the whole business, because a scoped series
   * under a field that no longer names a product would have nothing on screen explaining it. The
   * picker's reset emits null, which returns the timeline to all products if one was scoped and does
   * nothing if none was; the guard in {@link setCashFlowProduct} decides which.
   */
  protected setCashFlowSupplier(supplier: SupplierResponse | null): void {
    this.cashFlowSupplier.set(supplier);
  }

  /**
   * Scopes the timeline to one product, or back to the whole business when cleared.
   *
   * <p>Refetches immediately, unlike the analytics tab: there is already a series on screen, and
   * this changes what it covers rather than answering a question that had no answer before. The
   * per-product table below is untouched - it already answers the per-product question in rows, and
   * scoping it to one of them would leave a table of one.
   */
  protected setCashFlowProduct(product: SupplierProduct | null): void {
    // Same guard as every preset toggle on this page: re-picking what is already scoped, or
    // clearing a field that scoped nothing, is no reason to go back to the server.
    if ((this.cashFlowProduct()?.id ?? null) === (product?.id ?? null)) {
      return;
    }
    this.cashFlowProduct.set(product);
    this.loadCashFlow();
  }

  private loadCashFlow(): void {
    this.status.error.set(null);
    this.status.loading.set(true);
    const range = periodRange(this.cashFlowPeriod());
    // undefined rather than null so the service leaves the parameter off entirely.
    const productId = this.cashFlowProduct()?.id ?? undefined;

    this.reports.cashFlowTimeline(range.from, range.to, productId).subscribe({
      next: (months) => {
        this.cashFlowMonths.set(months);
        // Translated at build time: chart options are snapshots, as everywhere else on this page.
        this.status.loading.set(false);
      },
      error: (err: Error) => this.status.fail(err)
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
      error: (err: Error) => this.status.fail(err)
    });
  }

  /**
   * Headers and separators are resolved at click time, so the file matches the UI language.
   *
   * <p>The three list pages export the same way, so the body of this moved to
   * {@link CsvExportService} rather than being copied a fourth time. This stays as the page's own
   * default for `keyPrefix`, which is the only part that was ever page-specific.
   */
  private exportCsv(
    filename: string,
    columns: string[],
    rows: (string | number | null)[][],
    keyPrefix = 'reports.columns.'
  ): void {
    this.csv.export(filename, columns, rows, keyPrefix);
  }

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
function toPriceHistoryOption(points: PricePoint[], format: ChartFormat): ChartOption | null {
  if (points.length < 2) {
    return null;
  }

  return {
    tooltip: { trigger: 'axis', valueFormatter: (value) => format.currency(value as number) },
    grid: { left: 8, right: 24, top: 16, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: points.map((point) => point.date),
      axisLabel: { formatter: (value: string) => format.date(value) }
    },
    yAxis: { type: 'value', axisLabel: { formatter: (value: number) => format.currency(value) } },
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
  labels: { stock: string; sold: string },
  format: ChartFormat
): ChartOption | null {
  if (points.length === 0) {
    return null;
  }

  return {
    // Counts, not money - the one chart on this page whose values carry no currency. Units held
    // and units sold with a euro sign on them would be a different, and wrong, report.
    tooltip: { trigger: 'axis', valueFormatter: (value) => format.count(value as number) },
    // Same inset as the other legended charts: the bottom has to clear the date labels and the
    // legend row, which a smaller value lets draw over each other.
    legend: { bottom: 0 },
    grid: { left: 8, right: 24, top: 32, bottom: 48, containLabel: true },
    xAxis: {
      type: 'category',
      data: points.map((point) => point.date),
      axisLabel: { formatter: (value: string) => format.date(value) }
    },
    yAxis: { type: 'value', axisLabel: { formatter: (value: number) => format.count(value) } },
    series: [
      { name: labels.stock, type: 'line', step: 'end', data: points.map((point) => point.stockLevel) },
      { name: labels.sold, type: 'line', data: points.map((point) => point.cumulativeSoldUnits) }
    ]
  };
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
function toCashFlowOption(
  months: CashFlowTimelineBucket[],
  labels: CashFlowLabels,
  format: ChartFormat
): ChartOption | null {
  if (months.length === 0) {
    return null;
  }

  return {
    tooltip: { trigger: 'axis', valueFormatter: (value) => format.currency(value as number) },
    // Same inset as the due chart: with containLabel the bottom has to clear the axis labels AND
    // the legend row, which a smaller value lets the two draw on top of each other.
    legend: { bottom: 0 },
    grid: { left: 8, right: 24, top: 32, bottom: 48, containLabel: true },
    // The month KEYS stay the axis data: they are what the endpoint delivered, what the series are
    // indexed by and what puts the months in order. The reader sees them through the formatter.
    xAxis: {
      type: 'category',
      data: months.map((month) => month.month),
      axisLabel: { formatter: (value: string) => format.month(value) }
    },
    yAxis: { type: 'value', axisLabel: { formatter: (value: number) => format.currency(value) } },
    // Three plain lines, and deliberately NOT step-lines - the opposite of the analytics tab's two
    // series. A stock level or a price is a state that holds until something changes it, so a step
    // is the truth there. A month's cash flow is a measurement of that month alone: nothing is held
    // between two points, so a step would draw a plateau the business never sat at.
    //
    // Net is the reading the tab exists for - the two gross figures are how it got there - so it
    // carries the heavier stroke and the others stay thin enough to read behind it.
    series: [
      { name: labels.inflow, type: 'line', data: months.map((month) => month.inflow) },
      { name: labels.outflow, type: 'line', data: months.map((month) => month.outflow) },
      {
        name: labels.net,
        type: 'line',
        lineStyle: { width: 3 },
        symbolSize: 8,
        data: months.map((month) => month.net)
      }
    ]
  };
}

/**
 * Builds the loss-share pie, or null when nothing has actually been written off. A pie of
 * zero-valued slices draws no arcs at all, so the empty state is the honest rendering.
 */
function toLossOption(
  rows: LossReport[],
  otherLabel: string,
  format: ChartFormat
): ChartOption | null {
  const slices = rows.filter((row) => row.lossValue > 0);
  if (slices.length === 0) {
    return null;
  }

  return {
    tooltip: { trigger: 'item', valueFormatter: (value) => format.currency(value as number) },
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
function toDueOption(buckets: DueDateBucket[], format: ChartFormat): ChartOption | null {
  if (buckets.length === 0) {
    return null;
  }
  const dates = [...new Set(buckets.map((bucket) => bucket.dueDate))].sort();
  const types = [...new Set(buckets.map((bucket) => bucket.invoiceType))].sort();

  return {
    tooltip: { trigger: 'axis', valueFormatter: (value) => format.currency(value as number) },
    // The legend sits below the axis rather than floating over it: with containLabel the grid's
    // bottom inset has to cover the date labels AND the legend row, which the previous 24px did
    // not, so the two drew on top of each other at both chart heights.
    legend: { bottom: 0 },
    grid: { left: 8, right: 24, top: 32, bottom: 48, containLabel: true },
    // Raw ISO keys as data, the reader's format as labels - the sort above depends on the keys.
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLabel: { formatter: (value: string) => format.date(value) }
    },
    yAxis: { type: 'value', axisLabel: { formatter: (value: number) => format.currency(value) } },
    series: types.map((type) => ({
      name: type,
      type: 'line' as const,
      areaStyle: {},
      data: dates.map((date) => bucketValueAt(buckets, date, type))
    }))
  };
}
