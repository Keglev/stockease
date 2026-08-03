import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';

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
import { ChartComponent, ChartOption } from '../../../shared/chart/chart.component';
import { CSV_DOWNLOADER } from '../../../shared/csv/csv-export';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { ProfitDetailDialogComponent } from '../profit-detail-dialog/profit-detail-dialog.component';
import { AuditService } from '../../audit/audit.service';
import { ProductService } from '../../products/product.service';
import { ReportService } from '../report.service';
import { ReportsPageComponent } from './reports-page.component';

const TRANSLATIONS = {
  en: {
    invoices: { type: { PURCHASE: 'Purchase', SALE: 'Sale' } },
    audit: {
      field: { NAME: 'Name', PURCHASE_PRICE: 'Purchase price', DELETED: 'Deleted', RESTORED: 'Restored' }
    },
    charts: { other: 'Other' },
    reports: {
      title: 'Reports',
      refresh: 'Refresh',
      loading: 'Loading report…',
      deletedHint: 'deleted',
      exportCsv: 'Export CSV',
      view: { chart: 'Chart', table: 'Table', list: 'List' },
      period: { d30: '30 days', d90: '90 days', d180: '180 days', year: 'This year', all: 'All' },
      cashFlow: {
        inflow: 'Inflow',
        outflow: 'Outflow',
        net: 'Net',
        columns: { name: 'Product', sku: 'SKU', inflow: 'Inflow', outflow: 'Outflow', net: 'Net' },
        empty: 'No paid invoices in this period.',
        filter: 'Filter by name or SKU'
      },
      tabs: {
        profit: 'Profit',
        cashFlow: 'Cash flow',
        stock: 'Stock',
        losses: 'Losses',
        dueDates: 'Due dates',
        changes: 'Changes',
        analytics: 'Analytics'
      },
      changes: {
        allUsers: 'All users',
        empty: 'No changes in this period.',
        columns: {
          time: 'Time',
          user: 'User',
          product: 'Product',
          field: 'Field',
          oldValue: 'Old value',
          newValue: 'New value'
        }
      },
      columns: {
        name: 'Name',
        sku: 'SKU',
        revenue: 'Revenue',
        cost: 'Cost',
        grossProfit: 'Gross profit',
        soldUnits: 'Sold units',
        soldRevenue: 'Sales revenue',
        inStockUnits: 'Units in stock',
        inStockValue: 'Stock value',
        lostUnits: 'Lost',
        destroyedUnits: 'Destroyed',
        lossValue: 'Loss value'
      },
      profit: {
        margin: 'Overall profit margin',
        byProduct: 'Profit by product',
        products: 'Profit per product',
        suppliers: 'Profit per supplier',
        empty: 'No profit has been recorded yet.',
        suppliersEmpty: 'No supplier has supplied a product yet.'
      },
      analytics: {
        selectProduct: 'Select a product to analyze',
        priceHistory: 'Purchase price over time',
        stockVsSales: 'Stock level vs. units sold',
        stockLevel: 'Stock level',
        soldUnits: 'Units sold',
        noPriceChanges: 'No price changes recorded.'
      },
      stock: { byValue: 'Products by stock value', empty: 'No products are currently in stock.' },
      losses: { byProduct: 'Loss share by product', empty: 'No losses have been recorded.' },
      due: {
        chart: 'Outstanding value by due date',
        dueSoon: 'Due soon',
        overdue: 'Overdue',
        daysOverdue: '{{days}} days late',
        empty: 'No invoices are currently outstanding.',
        dueSoonEmpty: 'No invoices fall due in the coming week.',
        overdueEmpty: 'No invoice is overdue.'
      }
    }
  }
};

const PROFIT: ProductProfitReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, revenue: 200, cost: 150, grossProfit: 50 },
  { productId: 4, name: 'Gadget', sku: 'SKU-4', deleted: true, revenue: 200, cost: 150, grossProfit: 50 }
];

const SUPPLIERS: SupplierProfitReport[] = [
  { supplierId: 7, name: 'Acme', revenue: 400, cost: 300, grossProfit: 100 }
];

const STOCK: StockStatusReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', soldUnits: 4, soldRevenue: 60, inStockUnits: 6, inStockValue: 30 },
  // A second row sharing no substring with the first, so a filter test proves narrowing and a
  // totals test proves summing rather than echoing one row.
  { productId: 4, name: 'Gadget', sku: 'ABC-4', soldUnits: 1, soldRevenue: 10, inStockUnits: 4, inStockValue: 20 }
];

const LOSSES: LossReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, lostUnits: 2, destroyedUnits: 1, lossValue: 15 },
  { productId: 4, name: 'Gadget', sku: 'ABC-4', deleted: false, lostUnits: 3, destroyedUnits: 4, lossValue: 25 }
];

const BUCKETS: DueDateBucket[] = [
  { dueDate: '2026-03-01', invoiceType: 'SALE', invoiceCount: 2, totalValue: 60 }
];

const DUE_SOON: InvoiceDueSummary[] = [
  {
    invoiceId: 9,
    invoiceNumber: 'RE-2026-0009',
    invoiceType: 'PURCHASE',
    counterparty: 'Acme',
    dueDate: '2026-03-05',
    outstandingValue: 40,
    daysOverdue: null
  }
];

const OVERDUE: InvoiceDueSummary[] = [
  {
    invoiceId: 1,
    invoiceNumber: 'RE-2026-0001',
    invoiceType: 'SALE',
    counterparty: 'Jane Doe',
    dueDate: '2026-02-01',
    outstandingValue: 30,
    daysOverdue: 5
  }
];

/** Stands in for the ECharts wrapper: jsdom has no canvas and the wrapper has its own spec. */
@Component({ selector: 'app-chart', template: '' })
class ChartStubComponent {
  readonly option = input.required<ChartOption>();
  readonly height = input('20rem');
}

const CASH_FLOW: CashFlowReport = {
  inflow: 500,
  outflow: 300,
  net: 200,
  products: [
    { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, inflow: 500, outflow: 300, net: 200 },
    // A second row whose name and SKU share no substring with the first, so a filter test can prove
    // it narrowed rather than happening to match everything.
    { productId: 4, name: 'Gadget', sku: 'ABC-4', deleted: false, inflow: 0, outflow: 0, net: 0 }
  ]
};

const TIMELINE: CashFlowTimelineBucket[] = [
  { month: '2026-02', inflow: 0, outflow: 300, net: -300 },
  { month: '2026-03', inflow: 500, outflow: 0, net: 500 }
];

const CHANGES: ChangeLogEntryResponse[] = [
  {
    id: 2,
    productId: 3,
    productName: 'Widget',
    sku: 'SKU-3',
    productDeleted: false,
    username: 'julia.brandt',
    field: 'NAME',
    oldValue: 'Old name',
    newValue: 'Widget',
    createdAt: '2026-03-14T10:00:00'
  },
  {
    id: 1,
    productId: 4,
    productName: 'Gadget',
    sku: 'ABC-4',
    productDeleted: true,
    username: 'markus.weber',
    field: 'PURCHASE_PRICE',
    oldValue: '10.00',
    newValue: '12.00',
    createdAt: '2026-03-13T09:00:00'
  }
];

/** Newest first, as the endpoint orders it; one row is deliberately not a number. */
const PRODUCT_CHANGES: ChangeLogResponse[] = [
  { id: 4, productId: 3, userId: 11, field: 'PURCHASE_PRICE', oldValue: '12.00', newValue: '14.00',
    createdAt: '2026-03-14T10:00:00' },
  { id: 3, productId: 3, userId: 11, field: 'NAME', oldValue: 'Old', newValue: 'Widget',
    createdAt: '2026-03-13T10:00:00' },
  { id: 2, productId: 3, userId: 11, field: 'PURCHASE_PRICE', oldValue: '10.00', newValue: '12.00',
    createdAt: '2026-03-12T10:00:00' }
];

const STOCK_HISTORY: StockHistoryPoint[] = [
  { date: '2026-03-12', stockLevel: 40, cumulativeSoldUnits: 0 },
  { date: '2026-03-14', stockLevel: 32, cumulativeSoldUnits: 8 }
];

const PRODUCTS: ProductResponse[] = [
  { id: 3, name: 'Widget', sku: 'SKU-3', quantity: 32, purchasePrice: 14, totalValue: 448,
    createdAt: '2026-01-02T03:04:00' }
];

class ProductServiceStub {
  getAll(): Observable<ProductResponse[]> {
    return of(PRODUCTS);
  }
}

class AuditServiceStub {
  changePayload: ChangeLogEntryResponse[] = CHANGES;
  calls = 0;
  ranges: (string | undefined)[][] = [];

  changes(from?: string, to?: string): Observable<ChangeLogEntryResponse[]> {
    this.calls++;
    this.ranges.push([from, to]);
    return of(this.changePayload);
  }

  /** The per-product listing the analytics tab reads its price series from. */
  productChangePayload: ChangeLogResponse[] = PRODUCT_CHANGES;
  productChangeIds: number[] = [];

  productChanges(productId: number): Observable<ChangeLogResponse[]> {
    this.productChangeIds.push(productId);
    return of(this.productChangePayload);
  }
}

class ReportServiceStub {
  profitPayload: ProductProfitReport[] = PROFIT;
  lossPayload: LossReport[] = LOSSES;
  cashFlowPayload: CashFlowReport = CASH_FLOW;
  calls: string[] = [];
  timelinePayload: CashFlowTimelineBucket[] = TIMELINE;
  /** Every from/to pair the page asked for, so the period presets can be asserted exactly. */
  cashFlowRanges: (string | undefined)[][] = [];
  timelineRanges: (string | undefined)[][] = [];
  lossRanges: (string | undefined)[][] = [];
  /** The same record for each profit endpoint, keyed by method so one period covers all three. */
  profitRanges: Record<string, (string | undefined)[][]> = { products: [], suppliers: [], detail: [] };
  detail: ProductProfitReport = PROFIT[0];

  cashFlow(from?: string, to?: string): Observable<CashFlowReport> {
    this.calls.push('cashFlow');
    this.cashFlowRanges.push([from, to]);
    return of(this.cashFlowPayload);
  }

  cashFlowTimeline(from?: string, to?: string): Observable<CashFlowTimelineBucket[]> {
    this.calls.push('cashFlowTimeline');
    this.timelineRanges.push([from, to]);
    return of(this.timelinePayload);
  }

  profitProducts(from?: string, to?: string): Observable<ProductProfitReport[]> {
    this.calls.push('profitProducts');
    this.profitRanges['products'].push([from, to]);
    return of(this.profitPayload);
  }

  profitSuppliers(from?: string, to?: string): Observable<SupplierProfitReport[]> {
    this.calls.push('profitSuppliers');
    this.profitRanges['suppliers'].push([from, to]);
    return of(SUPPLIERS);
  }

  profitProductDetail(id: number, from?: string, to?: string): Observable<ProductProfitReport> {
    this.calls.push(`profitProductDetail:${id}`);
    this.profitRanges['detail'].push([from, to]);
    return of(this.detail);
  }

  stockStatus(): Observable<StockStatusReport[]> {
    this.calls.push('stockStatus');
    return of(STOCK);
  }

  historyIds: number[] = [];
  historyRanges: (string | undefined)[][] = [];

  stockHistory(productId: number, from?: string, to?: string): Observable<StockHistoryPoint[]> {
    this.calls.push('stockHistory');
    this.historyIds.push(productId);
    this.historyRanges.push([from, to]);
    return of(STOCK_HISTORY);
  }

  losses(from?: string, to?: string): Observable<LossReport[]> {
    this.calls.push('losses');
    this.lossRanges.push([from, to]);
    return of(this.lossPayload);
  }

  dueDates(): Observable<DueDateBucket[]> {
    this.calls.push('dueDates');
    return of(BUCKETS);
  }

  dueSoon(): Observable<InvoiceDueSummary[]> {
    this.calls.push('dueSoon');
    return of(DUE_SOON);
  }

  overdue(): Observable<InvoiceDueSummary[]> {
    this.calls.push('overdue');
    return of(OVERDUE);
  }
}

describe('ReportsPageComponent', () => {
  let fixture: ComponentFixture<ReportsPageComponent>;
  let reports: ReportServiceStub;
  let audit: AuditServiceStub;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let download: ReturnType<typeof vi.fn>;

  function render(): void {
    fixture = TestBed.createComponent(ReportsPageComponent);
    fixture.detectChanges();
  }

  /** Flips a tab to its table half, which is what the chart/table toggle exists to do. */
  async function showTable(tab: number): Promise<void> {
    const page = fixture.componentInstance as unknown as {
      setView: (tab: number, view: 'chart' | 'table') => void;
    };
    page.setView(tab, 'table');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function textOf(selector: string): string {
    return host().querySelector(selector)?.textContent ?? '';
  }

  /**
   * Drives the tab group through the component's own handler and waits for the tab body to
   * attach, which MatTabGroup defers past the first change-detection pass.
   */
  async function activateTab(index: number): Promise<void> {
    const page = fixture.componentInstance as unknown as { activate: (i: number) => void };
    page.activate(index);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    // Only Date is faked: the period presets compute their bounds from today, and a test reading
    // the real clock would change its expected range every day. Timers stay real.
    vi.useFakeTimers({ toFake: ['Date'] });
    TestBed.resetTestingModule();
    reports = new ReportServiceStub();
    audit = new AuditServiceStub();
    dialog = { open: vi.fn() };
    download = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        // MatTabBody only attaches a tab body once its transition reports done, and jsdom fires
        // no transition events. Material's own token disables them without pulling in
        // @angular/animations, which this project does not depend on.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        provideRouter([]),
        provideTestTranslations(TRANSLATIONS),
        { provide: ReportService, useValue: reports },
        { provide: AuditService, useValue: audit },
        { provide: ProductService, useValue: new ProductServiceStub() },
        { provide: MatDialog, useValue: dialog },
        // A provider stub rather than a module mock, for the reason ADR 016 records: the module
        // registry is shared across the specs in a Vitest worker, a TestBed is not.
        { provide: CSV_DOWNLOADER, useValue: download }
      ]
    });
    TestBed.overrideComponent(ReportsPageComponent, {
      remove: { imports: [ChartComponent] },
      add: { imports: [ChartStubComponent] }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ngOnInit_firstRender_loadsOnlyTheProfitTab', () => {
    render();

    // The page must not fire all seven report queries on open.
expect(reports.calls).toEqual(['profitProducts', 'profitSuppliers']);
  });

  it('activate_stockTab_loadsStockOnFirstActivationOnly', async () => {
    render();
    await activateTab(2);
    expect(reports.calls).toContain('stockStatus');

    await activateTab(0);
    await activateTab(2);

    expect(reports.calls.filter((call) => call === 'stockStatus').length).toBe(1);
  });

  it('activate_dueTab_loadsAllThreeDueQueries', async () => {
    render();
    await activateTab(4);

    expect(reports.calls).toContain('dueDates');
    expect(reports.calls).toContain('dueSoon');
    expect(reports.calls).toContain('overdue');
  });

  it('marginGauge_revenueAndProfit_computesMarginPercentage', () => {
    render();
    const option = optionOf('marginOption');

    // 100 profit over 400 revenue is 25 percent.
    expect(option?.series?.[0]?.data?.[0]?.value).toBe(25);
  });

  it('marginGauge_zeroRevenue_rendersEmptyStateInsteadOfNaN', () => {
    reports.profitPayload = [
      { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, revenue: 0, cost: 0, grossProfit: 0 }
    ];
    render();

    expect(optionOf('marginOption')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.margin-empty')).not.toBeNull();
  });

  it('profitTable_deletedProduct_rendersDeletedHint', async () => {
    render();
    await showTable(0);

    const hints = host().querySelectorAll('.deleted-hint');
    expect(hints.length).toBe(1);
    expect(hints[0].textContent).toContain('deleted');
  });

  it('rowClick_profitRow_opensDialogWithFetchedDetail', async () => {
    render();
    await showTable(0);

    host().querySelector<HTMLElement>('.profit-row')?.click();

    expect(reports.calls).toContain('profitProductDetail:3');
    expect(dialog.open).toHaveBeenCalledWith(ProfitDetailDialogComponent, { data: PROFIT[0] });
  });

  it('dueLists_overdueRows_renderDaysOverdueAndDueSoonRowsDoNot', async () => {
    render();
    await activateTab(4);
    await showTable(4);

    expect(host().querySelector('.overdue-row')?.textContent).toContain('5 days late');
    expect(host().querySelector('.due-soon-row .days-overdue')).toBeNull();
  });

  it('dueLists_anyRow_linksToItsInvoice', async () => {
    render();
    await activateTab(4);
    await showTable(4);

    // The label names the invoice the way an operator does; the href keeps the technical id,
    // which stays the routing key (ADR 022).
    const link = host().querySelector('.overdue-row a');
    expect(link?.getAttribute('href')).toBe('/app/invoices/1');
    expect(link?.textContent?.trim()).toBe('RE-2026-0001');
  });

  it('toggleView_tableSelected_showsTableAndHidesChart', async () => {
    render();
    expect(host().querySelector('.profit-table')).toBeNull();

    await showTable(0);

    expect(host().querySelector('.profit-table')).not.toBeNull();
    expect(host().querySelector('.profit-chart-card')).toBeNull();
  });

  it('toggleView_switchTabsAndReturn_preservesChosenView', async () => {
    render();
    await showTable(0);

    await activateTab(2);
    await activateTab(0);

    // The view is a per-tab choice, so leaving the tab must not silently undo it.
    expect(host().querySelector('.profit-table')).not.toBeNull();
  });

  it('exportCsv_profitTableWithRows_invokesDownloadWithBuiltContent', async () => {
    render();
    await showTable(0);

    host().querySelector<HTMLButtonElement>('.export-profit')?.click();

    const [filename, content] = download.mock.calls[0] as [string, string];
    expect(filename).toBe('profit-products.csv');
    expect(content.startsWith(String.fromCharCode(0xfeff))).toBe(true);
    expect(content).toContain('Gross profit');
  });

  it('exportButton_emptyTable_isAbsent', async () => {
    reports.profitPayload = [];
    render();
    await showTable(0);

    expect(host().querySelector('.export-profit')).toBeNull();
  });

  it('refresh_onStockTab_refetchesOnlyThatTab', async () => {
    render();
    await activateTab(2);
    reports.calls = [];

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.reports-refresh')
      ?.click();
    fixture.detectChanges();

    expect(reports.calls).toEqual(['stockStatus']);
  });

  it('lossPie_lossesRecorded_buildsPieOption', async () => {
    render();
    await activateTab(3);

    expect(optionOf('lossOption')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.losses-empty')).toBeNull();
  });

  it('lossPie_allLossValuesZero_rendersEmptyStateInsteadOfEmptyPie', async () => {
    reports.lossPayload = [{ ...LOSSES[0], lostUnits: 0, destroyedUnits: 0, lossValue: 0 }];
    render();
    await activateTab(3);

    // A pie of zero-valued slices draws no arcs, so the empty state is the honest rendering.
    expect(optionOf('lossOption')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.losses-empty')).not.toBeNull();
  });

  it('analyticsTab_noProduct_showsSelectPrompt', async () => {
    render();
    await activateTab(6);

    // nothing is preselected, so neither series is fetched until a product is chosen
    expect(host().querySelector('.analytics-prompt')).not.toBeNull();
    expect(reports.calls).not.toContain('stockHistory');
  });

  it('analyticsTab_productChosen_fetchesBothSeries', async () => {
    render();
    await activateTab(6);

    await chooseAnalyticsProduct(3);

    // the stock series from the reporting endpoint, the price series from the audit trail
    expect(reports.historyIds).toEqual([3]);
    expect(audit.productChangeIds).toEqual([3]);
    expect(host().querySelector('.analytics-prompt')).toBeNull();
  });

  it('analyticsTab_presetChange_refetchesStockHistoryWithRange', async () => {
    vi.setSystemTime(new Date(2026, 2, 15, 12));
    render();
    await activateTab(6);
    await chooseAnalyticsProduct(3);

    await selectAnalyticsPeriod('d90');

    expect(reports.historyRanges.at(-1)).toEqual(['2025-12-15', '2026-03-15']);
  });

  it('analyticsTab_priceRowsUnparseable_skipsThem', async () => {
    audit.productChangePayload = [
      { ...PRODUCT_CHANGES[0], newValue: 'not a price' },
      PRODUCT_CHANGES[2]
    ];
    render();
    await activateTab(6);
    await chooseAnalyticsProduct(3);

    // one usable point is left, and one point is not a history: the no-changes state shows instead
    // of a line drawn through a value that was never a number
    expect(optionOf('analyticsPriceOption')).toBeNull();
    expect(host().querySelector('.analytics-no-prices')).not.toBeNull();
  });

  /** Picks a product through the component, the way the select does. */
  async function chooseAnalyticsProduct(productId: number): Promise<void> {
    const page = fixture.componentInstance as unknown as {
      setAnalyticsProduct: (value: number) => void;
    };
    page.setAnalyticsProduct(productId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Clicks an analytics period preset through the component, the way the toggle group does. */
  async function selectAnalyticsPeriod(period: string): Promise<void> {
    const page = fixture.componentInstance as unknown as {
      setAnalyticsPeriod: (value: string) => void;
    };
    page.setAnalyticsPeriod(period);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('changesTab_firstActivation_loadsLazily', async () => {
    render();
    expect(audit.calls).toBe(0);

    await activateTab(5);

    // no bounds on the default 'all' window, and only on first activation
    expect(audit.ranges).toEqual([[undefined, undefined]]);
    await activateTab(0);
    await activateTab(5);
    expect(audit.calls).toBe(1);
  });

  it('changesTab_presetChange_refetchesWithComputedRange', async () => {
    vi.setSystemTime(new Date(2026, 2, 15, 12));
    render();
    await activateTab(5);

    await selectChangePeriod('d30');

    expect(audit.ranges.at(-1)).toEqual(['2026-02-13', '2026-03-15']);
  });

  it('changesTab_userSelected_narrowsRowsAndExport', async () => {
    render();
    await activateTab(5);

    await setFilter('setChangeUser', 'markus.weber');

    expect(host().querySelectorAll('.change-table tbody tr').length).toBe(1);
    host().querySelector<HTMLButtonElement>('.export-changes')?.click();

    // the download carries the narrowed view, with the field label translated as the table shows it
    const [filename, content] = download.mock.calls[0] as [string, string];
    expect(filename).toBe('changes.csv');
    expect(content).toContain('markus.weber');
    expect(content).toContain('Purchase price');
    expect(content).not.toContain('julia.brandt');
  });

  it('changesTab_textFilter_matchesNameOrSku', async () => {
    render();
    await activateTab(5);

    await setFilter('setChangeFilter', 'abc-4');

    // matched on SKU, not on the product name, which shares no substring with it
    const rows = host().querySelectorAll('.change-table tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Gadget');
  });

  /** Clicks a changes period preset through the component, the way the toggle group does. */
  async function selectChangePeriod(period: string): Promise<void> {
    const page = fixture.componentInstance as unknown as {
      setChangePeriod: (value: string) => void;
    };
    page.setChangePeriod(period);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('stockTab_totalsStrip_sumsLoadedRows', async () => {
    render();
    await activateTab(2);

    // 30 + 20, 6 + 4, and two rows: the strip is the table added up, so the two cannot disagree
    expect(textOf('.stock-total-value')).toContain('50');
    expect(textOf('.stock-total-units').trim()).toBe('10');
    expect(textOf('.stock-total-products').trim()).toBe('2');
  });

  it('lossesTab_totalsStrip_sumsValueLostAndDestroyed', async () => {
    render();
    await activateTab(3);

    expect(textOf('.loss-total-value')).toContain('40');
    expect(textOf('.loss-total-lost').trim()).toBe('5');
    expect(textOf('.loss-total-destroyed').trim()).toBe('5');
  });

  it('lossesTab_presetChange_refetchesWithComputedRange', async () => {
    vi.setSystemTime(new Date(2026, 2, 15, 12));
    render();
    await activateTab(3);

    await selectLossPeriod('d90');

    // write-offs count on their booking date, so this is the profit tab's arithmetic, not cash flow's
    expect(reports.lossRanges.at(-1)).toEqual(['2025-12-15', '2026-03-15']);
  });

  it('stockTab_filter_narrowsRowsAndExport', async () => {
    render();
    await activateTab(2);
    await showTable(2);

    await setFilter('setStockFilter', 'abc-4');

    expect(host().querySelectorAll('.stock-table tbody tr').length).toBe(1);
    host().querySelector<HTMLButtonElement>('.export-stock')?.click();

    const [, content] = download.mock.calls[0] as [string, string];
    expect(content).toContain('Gadget');
    expect(content).not.toContain('Widget');
  });

  it('lossesTab_filter_narrowsRowsAndExport', async () => {
    render();
    await activateTab(3);
    await showTable(3);

    await setFilter('setLossFilter', 'widget');

    expect(host().querySelectorAll('.loss-table tbody tr').length).toBe(1);
    host().querySelector<HTMLButtonElement>('.export-losses')?.click();

    const [, content] = download.mock.calls[0] as [string, string];
    expect(content).toContain('Widget');
    expect(content).not.toContain('Gadget');
  });

  /** Types into one of the tabs' filters through the component, the way its input does. */
  async function setFilter(method: string, value: string): Promise<void> {
    const page = fixture.componentInstance as unknown as Record<string, (value: string) => void>;
    page[method](value);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Clicks a loss period preset through the component, the way the toggle group does. */
  async function selectLossPeriod(period: string): Promise<void> {
    const page = fixture.componentInstance as unknown as {
      setLossPeriod: (value: string) => void;
    };
    page.setLossPeriod(period);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('cashFlowTab_firstActivation_loadsTimelineLazily', async () => {
    render();
    expect(reports.calls).not.toContain('cashFlowTimeline');

    await activateTab(1);

    // no bounds on the default 'all' window, and only on first activation
    expect(reports.timelineRanges).toEqual([[undefined, undefined]]);
    await activateTab(0);
    await activateTab(1);
    expect(reports.timelineRanges).toHaveLength(1);
  });

  it('profitTab_defaultPreset_requestsNoParams', async () => {
    render();
    await fixture.whenStable();

    // 'all' is the default, and an open window is no window: neither call carries bounds.
    expect(reports.profitRanges['products']).toEqual([[undefined, undefined]]);
    expect(reports.profitRanges['suppliers']).toEqual([[undefined, undefined]]);
  });

  it('profitTab_presetSelected_refetchesBothCallsWithComputedRange', async () => {
    vi.setSystemTime(new Date(2026, 2, 15, 12));
    render();

    await selectProfitPeriod('d30');

    // both endpoints answer the same window - a filtered chart beside an unfiltered supplier
    // table would be worse than no filter at all
    expect(reports.profitRanges['products'].at(-1)).toEqual(['2026-02-13', '2026-03-15']);
    expect(reports.profitRanges['suppliers'].at(-1)).toEqual(['2026-02-13', '2026-03-15']);
  });

  it('profitTab_rowClickDuringActivePeriod_passesPeriodToDetail', async () => {
    vi.setSystemTime(new Date(2026, 2, 15, 12));
    render();
    await selectProfitPeriod('d30');
    await showTable(0);

    host().querySelector<HTMLElement>('.profit-row')?.click();

    // the dialog must not contradict the table row that opened it
    expect(reports.profitRanges['detail'].at(-1)).toEqual(['2026-02-13', '2026-03-15']);
  });

  /** Clicks a profit period preset through the component, the way the toggle group does. */
  async function selectProfitPeriod(period: string): Promise<void> {
    const page = fixture.componentInstance as unknown as {
      setProfitPeriod: (value: string) => void;
    };
    page.setProfitPeriod(period);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('timelineChart_presetChange_refetches', async () => {
    vi.setSystemTime(new Date(2026, 2, 15, 12));
    render();
    await activateTab(1);

    await selectPeriod('d30');

    // 30 days back from a pinned today, inclusive of today at the upper end
    expect(reports.timelineRanges.at(-1)).toEqual(['2026-02-13', '2026-03-15']);
  });

  it('period_d180_computesRange', async () => {
    vi.setSystemTime(new Date(2026, 2, 15, 12));
    render();
    await activateTab(1);

    await selectPeriod('d180');

    // 180 days back from the pinned today, the same arithmetic the shorter presets use
    expect(reports.timelineRanges.at(-1)).toEqual(['2025-09-16', '2026-03-15']);
  });

  it('tableView_firstSwitch_lazilyLoadsProducts', async () => {
    render();
    await activateTab(1);

    // the chart half needs only the timeline; the per-product query waits for a reader who wants it
    expect(reports.calls).not.toContain('cashFlow');

    await showTable(1);

    expect(reports.cashFlowRanges).toEqual([[undefined, undefined]]);
  });

  it('tableFilter_matchesNameOrSku_narrowsRowsAndExport', async () => {
    render();
    await activateTab(1);
    await showTable(1);

    await setCashFlowFilter('gadget');

    expect(host().querySelectorAll('.cash-flow-table tbody tr').length).toBe(1);
    host().querySelector<HTMLButtonElement>('.export-cash-flow')?.click();

    // the download mirrors the narrowed table rather than the whole report
    const [, content] = download.mock.calls[0] as [string, string];
    expect(content).toContain('Gadget');
    expect(content).not.toContain('Widget');
  });

  it('cashFlowTab_tableView_exportsCsvThroughSeam', async () => {
    render();
    await activateTab(1);
    await showTable(1);

    host().querySelector<HTMLButtonElement>('.export-cash-flow')?.click();

    const [filename, content] = download.mock.calls[0] as [string, string];
    expect(filename).toBe('cash-flow.csv');
    expect(content).toContain('Inflow');
  });

  it('cashFlowTab_negativeNet_rendersErrorColorClass', async () => {
    reports.timelinePayload = [{ month: '2026-03', inflow: 100, outflow: 300, net: -200 }];
    render();
    await activateTab(1);

    // the class, not the computed colour: jsdom resolves no tokens
    expect(host().querySelector('.cash-flow-net.cash-flow-negative')).not.toBeNull();
  });

  it('cashFlowTab_positiveNet_omitsErrorColorClass', async () => {
    render();
    await activateTab(1);

    // the other direction: the error colour is reserved for money going out net
    expect(host().querySelector('.cash-flow-net')).not.toBeNull();
    expect(host().querySelector('.cash-flow-net.cash-flow-negative')).toBeNull();
  });

  it('cashFlowTab_emptyTimeline_showsEmptyState', async () => {
    reports.timelinePayload = [];
    render();
    await activateTab(1);

    expect(host().querySelector('.cash-flow-empty')).not.toBeNull();
  });

  /** Types into the cash-flow filter through the component, the way the input does. */
  async function setCashFlowFilter(value: string): Promise<void> {
    const page = fixture.componentInstance as unknown as {
      setCashFlowFilter: (value: string) => void;
    };
    page.setCashFlowFilter(value);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Clicks a period preset through the component, the way the toggle group does. */
  async function selectPeriod(period: string): Promise<void> {
    const page = fixture.componentInstance as unknown as {
      setCashFlowPeriod: (value: string) => void;
    };
    page.setCashFlowPeriod(period);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Reads a chart option straight off the component; the stub renders nothing to assert on. */
  function optionOf(name: string): SeriesProbe | null {
    const page = fixture.componentInstance as unknown as Record<string, () => SeriesProbe | null>;
    return page[name]();
  }
});

interface SeriesProbe {
  series?: { data?: { value?: number }[] }[];
}
