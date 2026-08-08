import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

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
  StockStatusReport,
  SupplierProduct,
  SupplierProfitReport,
  SupplierResponse
} from '../../../core/api/api-models';
import { CSV_DOWNLOADER } from '../../../shared/csv/csv-export';
import { FormatService } from '../../../core/format/format.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { TypeaheadComponent } from '../../../shared/typeahead/typeahead.component';
import { provideFakeChartEngine } from '../../../testing/chart-testing';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { ProfitDetailDialogComponent } from '../profit-detail-dialog/profit-detail-dialog.component';
import { AuditService } from '../../audit/audit.service';
import { SupplierService } from '../../suppliers/supplier.service';
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
        allProducts: 'All products',
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
        lossValue: 'Loss value',
        remark: 'Cause'
      },
      profit: {
        margin: 'Overall profit margin',
        byProduct: 'Profit by product',
        products: 'Profit per product',
        suppliers: 'Profit per supplier',
        empty: 'No profit has been recorded yet.',
        suppliersEmpty: 'No supplier has supplied a product yet.'
      },
      search: { supplier: 'Search supplier', product: 'Search product', noMatches: 'No matches' },
      analytics: {
        show: 'Show',
        selectProduct: 'Select a product to analyze',
        priceHistory: 'Purchase price over time',
        stockVsSales: 'Stock level vs. units sold',
        stockLevel: 'Stock level',
        soldUnits: 'Units sold',
        noPriceChanges: 'No price changes recorded.'
      },
      stock: { byValue: 'Products by stock value', empty: 'No products are currently in stock.' },
      losses: {
        byProduct: 'Loss share by product',
        byRemark: 'Losses by cause',
        empty: 'No losses have been recorded.'
      },
      due: {
        chart: 'Outstanding value by due date',
        dueSoon: 'Due soon',
        overdue: 'Overdue',
        daysOverdue: '{{days}} days late',
        empty: 'No invoices are currently outstanding.',
        dueSoonEmpty: 'No invoices fall due in the coming week.',
        overdueEmpty: 'No invoice is overdue.'
      }
    },
    // The breakdown labels its causes with the movement form's own option keys rather than a
    // reports-local copy: one taxonomy, one set of translations.
    movements: {
      form: {
        remarkOption: {
          EXPIRED: 'Expired',
          IN_TRANSIT_TO_CUSTOMER: 'In transit to customer',
          INTERNAL: 'Internal',
          FROM_SUPPLIER: 'From supplier'
        }
      }
    }
  },
  // Only what the breakdown needs, in the one language pair the section is read in twice.
  de: {
    charts: { other: 'Sonstige' },
    reports: { losses: { byRemark: 'Verluste nach Ursache' }, columns: { remark: 'Ursache' } },
    movements: { form: { remarkOption: { EXPIRED: 'Abgelaufen' } } }
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

/* The same write-offs LOSSES holds, grouped by cause instead of by product. */
const LOSSES_BY_REMARK: LossByRemark[] = [
  { remark: 'EXPIRED', lostUnits: 1, destroyedUnits: 2, lossValue: 12 },
  { remark: 'IN_TRANSIT_TO_CUSTOMER', lostUnits: 3, destroyedUnits: 0, lossValue: 30 }
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

/* Newest first, as the endpoint orders it; one row is deliberately not a number. */
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

/* The supplier typeahead's source; the page never sends the supplier, only searches within it. */
class SupplierServiceStub {
  terms: string[] = [];
  payload: SupplierResponse[] = [
    { id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '2026-01-02T03:04:00' }
  ];

  search(name: string): Observable<SupplierResponse[]> {
    this.terms.push(name);
    return of(this.payload);
  }
}

class AuditServiceStub {
  changePayload: ChangeLogEntryResponse[] = CHANGES;
  calls = 0;
  ranges: (string | undefined)[][] = [];

  changes(from?: string, to?: string): Observable<ChangeLogEntryResponse[]> {
    this.calls++;
    this.ranges.push([from, to]);
    return this.failing.has('changes')
      ? throwError(() => new Error('changes is unavailable.'))
      : of(this.changePayload);
  }

  /* The per-product listing the analytics tab reads its price series from. */
  productChangePayload: ChangeLogResponse[] = PRODUCT_CHANGES;
  productChangeIds: number[] = [];

  /* Endpoints that must reject, so the analytics and changes error paths can be driven. */
  readonly failing = new Set<string>();

  productChanges(productId: number): Observable<ChangeLogResponse[]> {
    this.productChangeIds.push(productId);
    return this.failing.has('productChanges')
      ? throwError(() => new Error('productChanges is unavailable.'))
      : of(this.productChangePayload);
  }
}

class ReportServiceStub {
  /* Endpoints that must reject, so each tab's error path can be driven by name. */
  readonly failing = new Set<string>();

  /* Rejects when the endpoint is in {@link failing}, otherwise answers with the payload. */
  private answer<T>(endpoint: string, payload: T): Observable<T> {
    return this.failing.has(endpoint)
      ? throwError(() => new Error(`${endpoint} is unavailable.`))
      : of(payload);
  }

  profitPayload: ProductProfitReport[] = PROFIT;
  supplierPayload: SupplierProfitReport[] = SUPPLIERS;
  buckets: DueDateBucket[] = BUCKETS;
  stockHistoryPayload: StockHistoryPoint[] = STOCK_HISTORY;
  stockPayload: StockStatusReport[] = STOCK;
  dueSoonPayload: InvoiceDueSummary[] = DUE_SOON;
  overduePayload: InvoiceDueSummary[] = OVERDUE;
  /* Holds the profit query open, so the loading state can be observed mid-flight. */
  holdProfit = false;
  lossPayload: LossReport[] = LOSSES;
  lossRemarkPayload: LossByRemark[] = LOSSES_BY_REMARK;
  cashFlowPayload: CashFlowReport = CASH_FLOW;
  calls: string[] = [];
  timelinePayload: CashFlowTimelineBucket[] = TIMELINE;
  /* Every from/to pair the page asked for, so the period presets can be asserted exactly. */
  cashFlowRanges: (string | undefined)[][] = [];
  timelineRanges: (string | undefined)[][] = [];
  lossRanges: (string | undefined)[][] = [];
  lossRemarkRanges: (string | undefined)[][] = [];
  /* The same record for each profit endpoint, keyed by method so one period covers all three. */
  profitRanges: Record<string, (string | undefined)[][]> = { products: [], suppliers: [], detail: [] };
  detail: ProductProfitReport = PROFIT[0];

  cashFlow(from?: string, to?: string): Observable<CashFlowReport> {
    this.calls.push('cashFlow');
    this.cashFlowRanges.push([from, to]);
    return this.answer('cashFlow', this.cashFlowPayload);
  }

  /* Every productId the timeline was asked for, undefined meaning the whole business. */
  timelineProductIds: (number | undefined)[] = [];

  /* Fails only the scoped call, so the unscoped activation fetch still populates the tab. */
  timelineFailsWhenScoped = false;

  cashFlowTimeline(from?: string, to?: string, productId?: number): Observable<CashFlowTimelineBucket[]> {
    this.calls.push('cashFlowTimeline');
    this.timelineRanges.push([from, to]);
    this.timelineProductIds.push(productId);
    return this.timelineFailsWhenScoped && productId !== undefined
      ? throwError(() => new Error('Report unavailable.'))
      : of(this.timelinePayload);
  }

  /* Search terms the scoped product typeahead sent, so "nothing is fetched" can be asserted. */
  supplierProductTerms: string[] = [];
  supplierProductPayload: SupplierProduct[] = [];

  /* Stands in for the preview environment, whose backend does not serve this endpoint yet. */
  supplierProductsFails = false;

  supplierProducts(supplierId: number, name: string): Observable<SupplierProduct[]> {
    this.supplierProductTerms.push(name);
    return this.supplierProductsFails
      ? throwError(() => new Error('404 Not Found'))
      : of(this.supplierProductPayload);
  }

  profitProducts(from?: string, to?: string): Observable<ProductProfitReport[]> {
    this.calls.push('profitProducts');
    this.profitRanges['products'].push([from, to]);
    return this.holdProfit
      ? new Subject<ProductProfitReport[]>()
      : this.answer('profitProducts', this.profitPayload);
  }

  profitSuppliers(from?: string, to?: string): Observable<SupplierProfitReport[]> {
    this.calls.push('profitSuppliers');
    this.profitRanges['suppliers'].push([from, to]);
    return this.answer('profitSuppliers', this.supplierPayload);
  }

  /* The row is on screen but its detail fetch fails - a deleted product, or a dropped request. */
  detailFails = false;

  profitProductDetail(id: number, from?: string, to?: string): Observable<ProductProfitReport> {
    this.calls.push(`profitProductDetail:${id}`);
    this.profitRanges['detail'].push([from, to]);
    return this.detailFails
      ? throwError(() => new Error('Product with ID 3 not found.'))
      : of(this.detail);
  }

  stockStatus(): Observable<StockStatusReport[]> {
    this.calls.push('stockStatus');
    return this.answer('stockStatus', this.stockPayload);
  }

  historyIds: number[] = [];
  historyRanges: (string | undefined)[][] = [];

  stockHistory(productId: number, from?: string, to?: string): Observable<StockHistoryPoint[]> {
    this.calls.push('stockHistory');
    this.historyIds.push(productId);
    this.historyRanges.push([from, to]);
    return this.answer('stockHistory', this.stockHistoryPayload);
  }

  losses(from?: string, to?: string): Observable<LossReport[]> {
    this.calls.push('losses');
    this.lossRanges.push([from, to]);
    return this.answer('losses', this.lossPayload);
  }

  lossesByRemark(from?: string, to?: string): Observable<LossByRemark[]> {
    this.calls.push('lossesByRemark');
    this.lossRemarkRanges.push([from, to]);
    return this.answer('lossesByRemark', this.lossRemarkPayload);
  }

  dueDates(): Observable<DueDateBucket[]> {
    this.calls.push('dueDates');
    return this.answer('dueDates', this.buckets);
  }

  dueSoon(): Observable<InvoiceDueSummary[]> {
    this.calls.push('dueSoon');
    return this.answer('dueSoon', this.dueSoonPayload);
  }

  overdue(): Observable<InvoiceDueSummary[]> {
    this.calls.push('overdue');
    return this.answer('overdue', this.overduePayload);
  }
}

describe('ReportsPageComponent', () => {
  let fixture: ComponentFixture<ReportsPageComponent>;
  let reports: ReportServiceStub;
  let audit: AuditServiceStub;
  let suppliers: SupplierServiceStub;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let download: ReturnType<typeof vi.fn>;

  function render(): void {
    fixture = TestBed.createComponent(ReportsPageComponent);
    fixture.detectChanges();
  }

  /* Flips a tab to its table half, which is what the chart/table toggle exists to do. */
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

  /*
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
    suppliers = new SupplierServiceStub();
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
        { provide: SupplierService, useValue: suppliers },
        { provide: MatDialog, useValue: dialog },
        // A provider stub rather than a module mock, for the reason ADR 016 records: the module
        // registry is shared across the specs in a Vitest worker, a TestBed is not.
        { provide: CSV_DOWNLOADER, useValue: download },
        // The real ChartComponent renders, drawing through a fake engine. overrideComponent would
        // force a runtime recompile whose template is no longer attributed to
        // reports-page.component.html - the 0% this spec used to report while rendering it (#142).
        provideFakeChartEngine()
      ]
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

  it('rowClick_detailFetchFails_surfacesTheErrorAndOpensNoDialog', async () => {
    reports.detailFails = true;
    render();
    await showTable(0);

    host().querySelector<HTMLElement>('.profit-row')?.click();
    fixture.detectChanges();

    // Both halves matter: the dialog is a pure presenter, so opening it on a failed fetch would
    // render an empty shell rather than an error the reader can act on.
    expect(host().querySelector('.reports-error')?.textContent).toContain(
      'Product with ID 3 not found.'
    );
    expect(dialog.open).not.toHaveBeenCalled();
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

  it('chartOptions_languageSwitched_rebuildWithTheOtherLanguagesLabels', async () => {
    // Eleven rows so topNWithRemainder produces the one chart label this page translates.
    reports.profitPayload = Array.from({ length: 11 }, (unused, index) => ({
      productId: index + 1,
      name: `Product ${index + 1}`,
      sku: `SKU-${index + 1}`,
      deleted: false,
      revenue: 100,
      cost: 40,
      grossProfit: 60 - index
    }));
    render();
    await activateTab(0);

    const labelsOf = () =>
      JSON.stringify((optionOf('profitOption') as unknown as { yAxis: { data: string[] } }).yAxis.data);
    expect(labelsOf()).toContain('Other');

    TestBed.inject(LanguageService).setLanguage('de');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // The regression this slice fixes. Before it, the option was built once inside loadProfit with
    // translate.instant resolved and frozen in, and a language switch left it byte-identical -
    // measured, not assumed. Nothing refetches here: only the language changed.
    expect(labelsOf()).toContain('Sonstige');
    expect(labelsOf()).not.toContain('Other');
  });

  it('chartOptions_dataRefreshed_stillRebuild', async () => {
    render();
    await activateTab(0);
    expect(JSON.stringify(optionOf('profitOption'))).toContain('Widget');

    // The behaviour the imperative version had, pinned: deriving the options must not cost the
    // rebuild a refetch already triggered.
    reports.profitPayload = [
      { productId: 9, name: 'Sprocket', sku: 'SKU-9', deleted: false, revenue: 10, cost: 4, grossProfit: 6 }
    ];
    host().querySelector<HTMLButtonElement>('.reports-refresh')?.click();
    await settle();

    expect(JSON.stringify(optionOf('profitOption'))).toContain('Sprocket');
    expect(JSON.stringify(optionOf('profitOption'))).not.toContain('Widget');
  });

  /*
   * The values, rather than the labels the block above covers.
   *
   * <p>Asserted by CALLING the callbacks the option hands ECharts, with values the fixtures do not
   * contain. Nothing else can: the formatters are functions, so the option itself carries no
   * rendered string, and the fake engine paints nothing to read back. The values are chosen to be
   * ambiguous between the two locales - 1234.56 reads as a thousand or as one-and-a-bit depending
   * entirely on who is looking, which is the defect ADR 031 is about.
   */
  describe('chart values', () => {
    // Both preferences are set explicitly in every test below, because both persist to storage and
    // this file shares its origin with every other spec in the worker.
    afterEach(() => localStorage.clear());

    /*
     * Intl separates a currency symbol and a percent sign with a no-break space, and which one it
     * uses varies by ICU build. Normalised for the same reason FormatService's own spec does it.
     */
    const SPACES = new Set([0x20, 0xa0, 0x202f]);

    function plain(value: string): string {
      return [...value].map((ch) => (SPACES.has(ch.codePointAt(0) ?? 0) ? ' ' : ch)).join('');
    }

    function setFormats(lang: 'en' | 'de', numbers: 'auto' | 'en' | 'de'): void {
      TestBed.inject(LanguageService).setLanguage(lang);
      TestBed.inject(FormatService).setNumberFormat(numbers);
      fixture.detectChanges();
    }

    /* The callbacks one option hands ECharts, read straight off the component. */
    function formattersOf(name: string): FormatProbe {
      const page = fixture.componentInstance as unknown as Record<string, () => FormatProbe>;
      return page[name]();
    }

    function tooltipOf(name: string, value: number): string {
      return plain(formattersOf(name).tooltip?.valueFormatter?.(value) ?? '');
    }

    function xTickOf(name: string, value: string | number): string {
      return plain(formattersOf(name).xAxis?.axisLabel?.formatter?.(value) ?? '');
    }

    function yTickOf(name: string, value: number): string {
      return plain(formattersOf(name).yAxis?.axisLabel?.formatter?.(value) ?? '');
    }

    /* Puts the three tabs the triangle reads - profit, due dates, analytics - on screen. */
    async function showTheThreeShapes(): Promise<void> {
      render();
      await activateTab(0);
      await activateTab(4);
      await activateTab(6);
      await chooseAnalyticsProduct(3);
      await showAnalytics();
    }

    it('chartValues_germanInterfaceOnAuto_renderMoneyCountsAndDatesTheGermanWay', async () => {
      await showTheThreeShapes();

      setFormats('de', 'auto');

      expect(tooltipOf('profitOption', 1234.56)).toBe('1.234,56 €');
      expect(yTickOf('analyticsStockOption', 1234)).toBe('1.234');
      expect(xTickOf('dueOption', '2026-03-01')).toBe('01.03.2026');
    });

    it('chartValues_englishInterfaceOnAuto_renderMoneyCountsAndDatesTheEnglishWay', async () => {
      await showTheThreeShapes();

      setFormats('en', 'auto');

      expect(tooltipOf('profitOption', 1234.56)).toBe('€1,234.56');
      expect(yTickOf('analyticsStockOption', 1234)).toBe('1,234');
      expect(xTickOf('dueOption', '2026-03-01')).toBe('03/01/2026');
    });

    it('chartValues_germanInterfaceWithEnglishNumbers_followTheOverrideNotTheLanguage', async () => {
      await showTheThreeShapes();

      setFormats('de', 'en');

      // The third corner of the triangle, and the one a language-only implementation gets wrong:
      // the interface is German and every figure in it is English, because the reader said so.
      // The date follows too - it is on 'auto', and 'auto' means the effective number locale.
      expect(tooltipOf('profitOption', 1234.56)).toBe('€1,234.56');
      expect(yTickOf('analyticsStockOption', 1234)).toBe('1,234');
      expect(xTickOf('dueOption', '2026-03-01')).toBe('03/01/2026');
    });

    it('chartValues_stockHistory_areCountsRatherThanMoney', async () => {
      await showTheThreeShapes();
      setFormats('de', 'auto');

      // The one chart on this page whose values are units. A currency symbol here would state that
      // the warehouse holds 1234 euros of nothing in particular - so the assertion is the whole
      // string, grouped the German way and carrying no symbol, rather than an absence of one.
      expect(tooltipOf('analyticsStockOption', 1234)).toBe('1.234');
      expect(yTickOf('analyticsStockOption', 1234)).toBe('1.234');
    });

    it('chartValues_formatOverrideSwitchedMidSpec_rebuildTheOptionInTheOtherLocale', async () => {
      render();
      await activateTab(0);
      setFormats('de', 'auto');
      const before = formattersOf('profitOption');
      expect(tooltipOf('profitOption', 1234.56)).toBe('1.234,56 €');

      TestBed.inject(FormatService).setNumberFormat('en');
      fixture.detectChanges();

      // Reactivity for free from the #168 seam: nothing refetched and no data changed, only the
      // preference.
      //
      // The IDENTITY is the assertion that matters, and the reading beside it would pass without
      // it - measured. A formatter closes over the service rather than over a locale, so calling
      // the old option's callback after the switch already returns English. But nothing calls it:
      // ChartComponent hands echarts an option only when this derivation re-runs, so an option
      // that is still the object it was is a chart still showing the German labels it painted.
      // That is what the format reads in chartContext buy, and this is what pins them.
      const after = formattersOf('profitOption');
      expect(after).not.toBe(before);
      expect(tooltipOf('profitOption', 1234.56)).toBe('€1,234.56');
    });

    it('chartValues_dueDateAxis_keepsIsoKeysAsDataAndFormatsOnlyTheLabels', async () => {
      render();
      await activateTab(4);
      setFormats('de', 'auto');

      // Sorting and the series lookup both index by the raw key, so the DATA must stay raw - the
      // formatting is a rendering decision and lives only in the callback.
      const axis = formattersOf('dueOption').xAxis;
      expect(axis?.data).toEqual(['2026-03-01']);
      expect(plain(axis?.axisLabel?.formatter?.('2026-03-01') ?? '')).toBe('01.03.2026');
    });

    it('chartValues_cashFlowAxis_readsMonthKeysAsMonths', async () => {
      render();
      await activateTab(1);

      setFormats('de', 'auto');
      // The month keys are the shape FormatService did not cover; formatMonth is the addition.
      expect(formattersOf('cashFlowOption').xAxis?.data).toEqual(['2026-02', '2026-03']);
      expect(xTickOf('cashFlowOption', '2026-03')).toBe('März 2026');

      setFormats('en', 'auto');
      expect(xTickOf('cashFlowOption', '2026-03')).toBe('Mar 2026');
    });

    /*
     * Every value surface on the page in one pass, which is the point: the routing decision - is
     * this figure money or a count - is made once per axis and per tooltip, and the ones the
     * triangle above does not reach are exactly where a wrong one would survive unnoticed.
     */
    it('chartValues_everySurface_routeMoneyToCurrencyAndUnitsToCounts', async () => {
      await showTheThreeShapes();
      await activateTab(1);
      await activateTab(2);
      await activateTab(3);
      setFormats('de', 'auto');

      const money = ['profitOption', 'stockOption', 'lossOption', 'dueOption', 'cashFlowOption', 'analyticsPriceOption'];
      for (const name of money) {
        expect(tooltipOf(name, 1234.56)).toBe('1.234,56 €');
      }

      // The value axis, whichever way each chart is oriented: the two bar charts lie on their
      // side, so their VALUE axis is x and their category axis is y.
      expect(xTickOf('profitOption', 1234.56)).toBe('1.234,56 €');
      expect(xTickOf('stockOption', 1234.56)).toBe('1.234,56 €');
      expect(yTickOf('dueOption', 1234.56)).toBe('1.234,56 €');
      expect(yTickOf('cashFlowOption', 1234.56)).toBe('1.234,56 €');
      expect(yTickOf('analyticsPriceOption', 1234.56)).toBe('1.234,56 €');

      // The date axes, all reading the reader's own order and separators from a raw ISO key.
      expect(xTickOf('analyticsPriceOption', '2026-03-01')).toBe('01.03.2026');
      expect(xTickOf('analyticsStockOption', '2026-03-01')).toBe('01.03.2026');

      // And the one exception, stated as a whole string rather than as an absent symbol.
      expect(tooltipOf('analyticsStockOption', 1234)).toBe('1.234');
    });

    it('chartValues_marginGauge_readsThePercentInTheReadersOwnNumbers', async () => {
      render();
      await activateTab(0);

      setFormats('de', 'auto');
      const detailOf = () => formattersOf('marginOption').series?.[0]?.detail?.formatter;
      // 42.5 is what the dial itself is set to; only the reading changes. The literal '{value}%'
      // this replaces printed 42.5% at a German reader who writes 42,5 %.
      expect(plain(detailOf()?.(42.5) ?? '')).toBe('42,5 %');

      setFormats('en', 'auto');
      expect(plain(detailOf()?.(42.5) ?? '')).toBe('42.5%');
    });
  });

  it('lossPie_allLossValuesZero_rendersEmptyStateInsteadOfEmptyPie', async () => {
    reports.lossPayload = [{ ...LOSSES[0], lostUnits: 0, destroyedUnits: 0, lossValue: 0 }];
    render();
    await activateTab(3);

    // A pie of zero-valued slices draws no arcs, so the empty state is the honest rendering.
    expect(optionOf('lossOption')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.losses-empty')).not.toBeNull();
  });

  it('analyticsTab_noProduct_showsSelectPromptAndFetchesNoCatalogue', async () => {
    render();
    await activateTab(6);

    // The tab now fetches nothing at all on activation: the pickers query as they are typed into,
    // where the old full-list select pulled the whole catalogue down to offer one row of it.
    expect(host().querySelector('.analytics-prompt')).not.toBeNull();
    expect(reports.calls).not.toContain('stockHistory');
    expect(reports.supplierProductTerms).toEqual([]);
  });

  it('analytics_productChosenWithoutShow_fetchesNothing', async () => {
    render();
    await activateTab(6);

    await chooseAnalyticsProduct(3);

    // choosing states an interest; the Show button is where the user asks. Until then the tab is
    // exactly as it was, prompt included.
    expect(reports.historyIds).toEqual([]);
    expect(audit.productChangeIds).toEqual([]);
    expect(host().querySelector('.analytics-prompt')).not.toBeNull();
  });

  it('analytics_activatedWithNothingShown_clearsTheLoadingBar', async () => {
    render();

    await activateTab(6);

    // loadTab raises the bar for every tab; the analytics tab is the only one that can then decide
    // it has nothing to fetch, so it has to lower it again rather than leave it running forever
    expect(host().querySelector('mat-progress-bar')).toBeNull();
  });

  it('analytics_searchFails_leavesTheTabUsable', async () => {
    render();
    await activateTab(6);
    reports.supplierProductsFails = true;

    page().setAnalyticsSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    await settle();

    // A failing suggestion query is not the tab's error: nothing was asked for yet.
    expect(host().querySelector('mat-progress-bar')).toBeNull();
    expect(host().querySelector('.reports-error')).toBeNull();
  });

  it('analytics_show_fetchesBothSeries', async () => {
    render();
    await activateTab(6);
    await chooseAnalyticsProduct(3);

    await showAnalytics();

    // the stock series from the reporting endpoint, the price series from the audit trail
    expect(reports.historyIds).toEqual([3]);
    expect(audit.productChangeIds).toEqual([3]);
    expect(host().querySelector('.analytics-prompt')).toBeNull();
  });

  it('analytics_productSwitchedWithoutShow_keepsShowingTheOldOne', async () => {
    render();
    await activateTab(6);
    await chooseAnalyticsProduct(3);
    await showAnalytics();

    await chooseAnalyticsProduct(4);

    // switching the picked product is not a request, so nothing is refetched for it
    expect(reports.historyIds).toEqual([3]);
  });

  it('analytics_presetChangeWhileShown_refetches', async () => {
    vi.setSystemTime(new Date(2026, 2, 15, 12));
    render();
    await activateTab(6);
    await chooseAnalyticsProduct(3);
    await showAnalytics();

    await selectAnalyticsPeriod('d90');

    // presets re-query the product already shown: that is the user's standing request, and the
    // window is which slice of it they want rather than a new subject
    expect(reports.historyRanges.at(-1)).toEqual(['2025-12-15', '2026-03-15']);
    expect(reports.historyIds).toEqual([3, 3]);
  });

  it('analytics_presetChangeBeforeShow_fetchesNothing', async () => {
    render();
    await activateTab(6);
    await chooseAnalyticsProduct(3);

    await selectAnalyticsPeriod('d90');

    // there is no standing request to re-run yet
    expect(reports.historyIds).toEqual([]);
  });

  it('analyticsTab_priceRowsUnparseable_skipsThem', async () => {
    audit.productChangePayload = [
      { ...PRODUCT_CHANGES[0], newValue: 'not a price' },
      PRODUCT_CHANGES[2]
    ];
    render();
    await activateTab(6);
    await chooseAnalyticsProduct(3);
    await showAnalytics();

    // one usable point is left, and one point is not a history: the no-changes state shows instead
    // of a line drawn through a value that was never a number
    expect(optionOf('analyticsPriceOption')).toBeNull();
    expect(host().querySelector('.analytics-no-prices')).not.toBeNull();
  });

  /* A row of the shape the supplier-scoped product search answers with. */
  function productRow(id: number): SupplierProduct {
    return {
      id,
      name: `Product ${id}`,
      sku: `SKU-${id}`,
      quantity: 1,
      purchasePrice: 1,
      totalValue: 1,
      createdAt: '2026-01-02T03:04:00'
    };
  }

  /* Access to the handlers the typeaheads and the Show button call. */
  function page(): {
    setAnalyticsSupplier: (value: SupplierResponse | null) => void;
    setAnalyticsProduct: (value: SupplierProduct | null) => void;
    showAnalytics: () => void;
    setAnalyticsPeriod: (value: string) => void;
    setCashFlowSupplier: (value: SupplierResponse | null) => void;
    setCashFlowProduct: (value: SupplierProduct | null) => void;
  } {
    return fixture.componentInstance as never;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /*
   * Picks a product without asking for it, which is now the whole of choosing: the cascade sets a
   * supplier first, and only the Show button fetches.
   */
  async function chooseAnalyticsProduct(productId: number): Promise<void> {
    page().setAnalyticsSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    page().setAnalyticsProduct(productRow(productId));
    await settle();
  }

  /* Presses Show, the only control that fetches the two analytics series. */
  async function showAnalytics(): Promise<void> {
    page().showAnalytics();
    await settle();
  }

  /* Clicks an analytics period preset through the component, the way the toggle group does. */
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

  /* Clicks a changes period preset through the component, the way the toggle group does. */
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

  /* Types into one of the tabs' filters through the component, the way its input does. */
  async function setFilter(method: string, value: string): Promise<void> {
    const page = fixture.componentInstance as unknown as Record<string, (value: string) => void>;
    page[method](value);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /* Clicks a loss period preset through the component, the way the toggle group does. */
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

  it('cashflow_productScoped_refetchesTimelineWithParam', async () => {
    render();
    await activateTab(1);

    page().setCashFlowSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    page().setCashFlowProduct(productRow(3));
    await settle();

    // the timeline is refetched scoped; the first call was the unscoped one on activation
    expect(reports.timelineProductIds).toEqual([undefined, 3]);
    // the table is untouched: it already answers the per-product question in rows
    expect(reports.calls.filter((call) => call === 'cashFlow')).toEqual([]);
    expect(host().textContent).toContain('Product 3');
  });

  it('cashflow_scopedFetchFails_clearsTheLoadingBarAndReportsIt', async () => {
    render();
    await activateTab(1);
    reports.timelineFailsWhenScoped = true;

    page().setCashFlowSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    page().setCashFlowProduct(productRow(3));
    await settle();

    // Unlike a suggestion query, this IS the report the reader asked for, so it surfaces - but the
    // bar comes down either way. Pinned because the analytics tab lost exactly this property.
    expect(host().querySelector('mat-progress-bar')).toBeNull();
    expect(host().querySelector('.reports-error')?.textContent).toContain('Report unavailable.');
  });

  it('cashflow_clear_returnsToAllProducts', async () => {
    render();
    await activateTab(1);
    page().setCashFlowSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    page().setCashFlowProduct(productRow(3));
    await settle();

    page().setCashFlowProduct(null);
    await settle();

    expect(reports.timelineProductIds).toEqual([undefined, 3, undefined]);
    // and the scope line says so rather than going blank
    expect(host().textContent).toContain('All products');
  });

  it('cashflow_supplierChangedWithNoProductScoped_doesNotRefetch', async () => {
    render();
    await activateTab(1);

    page().setCashFlowSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    await settle();

    // the supplier is a navigation aid, never a query dimension: it narrows the product search and
    // nothing else, so choosing one asks the server nothing
    expect(reports.timelineProductIds).toEqual([undefined]);
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

  /* Clicks a profit period preset through the component, the way the toggle group does. */
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

  /* Types into the cash-flow filter through the component, the way the input does. */
  async function setCashFlowFilter(value: string): Promise<void> {
    const page = fixture.componentInstance as unknown as {
      setCashFlowFilter: (value: string) => void;
    };
    page.setCashFlowFilter(value);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /* Clicks a period preset through the component, the way the toggle group does. */
  async function selectPeriod(period: string): Promise<void> {
    const page = fixture.componentInstance as unknown as {
      setCashFlowPeriod: (value: string) => void;
    };
    page.setCashFlowPeriod(period);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /* Reads a chart option straight off the component; the stub renders nothing to assert on. */
  function optionOf(name: string): SeriesProbe | null {
    const page = fixture.componentInstance as unknown as Record<string, () => SeriesProbe | null>;
    return page[name]();
  }

  /* Clicks a sortable column header, which is the only way a reader reorders a report table. */
  async function sortBy(table: string, columnIndex: number): Promise<void> {
    const headers = host().querySelectorAll<HTMLElement>(`${table} th.mat-sort-header`);
    headers[columnIndex].click();
    await settle();
  }

  /* The visible text of one column, top to bottom, which is what sorting rearranges. */
  function columnText(table: string, columnIndex: number): string[] {
    return Array.from(host().querySelectorAll(`${table} tbody tr`)).map(
      (row) => row.querySelectorAll('td')[columnIndex].textContent?.trim() ?? ''
    );
  }

  it('sortProfit_nameHeaderClicked_ordersRowsAlphabeticallyThenReverses', async () => {
    reports.profitPayload = [
      { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, revenue: 9, cost: 1, grossProfit: 8 },
      { productId: 4, name: 'Gadget', sku: 'SKU-4', deleted: false, revenue: 100, cost: 1, grossProfit: 99 }
    ];
    render();
    await showTable(0);

    await sortBy('.profit-table', 0);
    expect(columnText('.profit-table', 0)).toEqual(['Gadget', 'Widget']);

    await sortBy('.profit-table', 0);
    expect(columnText('.profit-table', 0)).toEqual(['Widget', 'Gadget']);
  });

  it('sortProfit_numericColumn_ordersByValueRatherThanByText', async () => {
    reports.profitPayload = [
      { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, revenue: 9, cost: 1, grossProfit: 8 },
      { productId: 4, name: 'Gadget', sku: 'SKU-4', deleted: false, revenue: 100, cost: 1, grossProfit: 99 }
    ];
    render();
    await showTable(0);

    // Sorted as text, 100 would come before 9 - which is the whole reason the comparator checks
    // the operand types rather than stringifying everything.
    await sortBy('.profit-table', 2);
    expect(columnText('.profit-table', 0)).toEqual(['Widget', 'Gadget']);
  });

  it('sortProfit_clickedPastDescending_returnsToTheServerOrder', async () => {
    render();
    await showTable(0);
    const asLoaded = columnText('.profit-table', 0);

    await sortBy('.profit-table', 0);
    await sortBy('.profit-table', 0);
    await sortBy('.profit-table', 0);

    // The third click clears the direction, and an unsorted table is the order the server sent.
    expect(columnText('.profit-table', 0)).toEqual(asLoaded);
  });

  it('sortSuppliers_nameHeaderClicked_ordersRows', async () => {
    render();
    await showTable(0);

    await sortBy('.supplier-table', 0);

    const names = columnText('.supplier-table', 0);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('sortStock_nameHeaderClicked_ordersRows', async () => {
    render();
    await activateTab(2);
    await showTable(2);

    await sortBy('.stock-table', 0);

    const names = columnText('.stock-table', 0);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('sortLosses_nameHeaderClicked_ordersRows', async () => {
    render();
    await activateTab(3);
    await showTable(3);

    await sortBy('.loss-table', 0);

    const names = columnText('.loss-table', 0);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  /*
   * The typeahead the page put at this selector, reached as a component so the spec can call the
   * `[search]` function the template bound and emit the `(selected)` output the template listens to.
   *
   * <p>Typing into the field instead would wait out the typeahead's debounce on a real timer, and
   * this spec fakes only `Date`. What is under test here is the binding, not the debounce, which
   * the typeahead's own spec already owns.
   */
  function typeaheadAt(selector: string): TypeaheadComponent<SupplierProduct> {
    return fixture.debugElement
      .query(By.css(selector))
      .componentInstance as TypeaheadComponent<SupplierProduct>;
  }

  it('analyticsProductSearch_supplierChosen_queriesThatSuppliersCatalogueOnly', async () => {
    render();
    await activateTab(6);
    page().setAnalyticsSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    await settle();

    typeaheadAt('.analytics-product-search').search()('wid').subscribe();

    expect(reports.supplierProductTerms).toEqual(['wid']);
  });

  it('analyticsProductSearch_noSupplierChosen_asksTheServerNothing', async () => {
    render();
    await activateTab(6);

    let emitted: SupplierProduct[] | undefined;
    typeaheadAt('.analytics-product-search').search()('wid').subscribe((rows) => (emitted = rows));

    // No supplier means no scope to search within, so the field answers empty without a request.
    expect(emitted).toEqual([]);
    expect(reports.supplierProductTerms).toEqual([]);
  });

  it('analyticsProductField_selectionEmitted_enablesTheShowButton', async () => {
    render();
    await activateTab(6);
    page().setAnalyticsSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    await settle();

    typeaheadAt('.analytics-product-search').selected.emit(productRow(3));
    await settle();

    expect(host().querySelector<HTMLButtonElement>('.analytics-show')?.disabled).toBe(false);
  });

  it('analyticsShowButton_clicked_fetchesBothSeries', async () => {
    render();
    await activateTab(6);
    await chooseAnalyticsProduct(3);

    host().querySelector<HTMLButtonElement>('.analytics-show')?.click();
    await settle();

    expect(reports.historyIds).toEqual([3]);
    expect(audit.productChangeIds).toEqual([3]);
  });

  it('cashFlowProductField_selectionEmitted_refetchesTheTimelineScopedToIt', async () => {
    render();
    await activateTab(1);
    page().setCashFlowSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    await settle();

    typeaheadAt('.cash-flow-product-search').selected.emit(productRow(3));
    await settle();

    expect(reports.timelineProductIds.at(-1)).toBe(3);
  });

  /* The banner every tab reports a failed load through, and the bar that must stop with it. */
  function expectFailureBanner(message: string): void {
    expect(host().querySelector('.reports-error')?.textContent?.trim()).toBe(message);
    expect(host().querySelector('mat-progress-bar')).toBeNull();
  }

  // Each tab fires its queries in order and every failure overwrites the banner, so the message
  // asserted is the last one to land - which is also what a reader would see.
  it('profitTab_bothQueriesFail_reportsItAndStopsTheLoadingBar', async () => {
    reports.failing.add('profitProducts').add('profitSuppliers');

    render();
    await settle();

    expectFailureBanner('profitSuppliers is unavailable.');
  });

  it('stockTab_queryFails_reportsItAndStopsTheLoadingBar', async () => {
    reports.failing.add('stockStatus');
    render();

    await activateTab(2);

    expectFailureBanner('stockStatus is unavailable.');
  });

  it('lossesTab_queryFails_reportsItAndStopsTheLoadingBar', async () => {
    reports.failing.add('losses');
    render();

    await activateTab(3);

    expectFailureBanner('losses is unavailable.');
  });

  it('lossRemarkSection_queryFails_reportsItAndLeavesTheProductTableIntact', async () => {
    // Only the breakdown rejects. It reports through the tab's single banner rather than adding a
    // second error line, and the per-product half - which answered fine - stays on screen.
    reports.failing.add('lossesByRemark');
    render();

    await activateTab(3);

    expectFailureBanner('lossesByRemark is unavailable.');
    expect(host().querySelector('.loss-remark-table')).toBeNull();
    expect(host().querySelector('.losses-remark-empty')).not.toBeNull();
    expect((fixture.componentInstance as unknown as { lossRows: () => unknown[] }).lossRows())
      .toHaveLength(2);
  });

  it('dueTab_allThreeQueriesFail_reportsItAndStopsTheLoadingBar', async () => {
    reports.failing.add('dueDates').add('dueSoon').add('overdue');
    render();

    await activateTab(4);

    expectFailureBanner('overdue is unavailable.');
  });

  it('changesTab_queryFails_reportsItAndStopsTheLoadingBar', async () => {
    audit.failing.add('changes');
    render();

    await activateTab(5);

    expectFailureBanner('changes is unavailable.');
  });

  it('analyticsTab_bothSeriesFail_reportsItAndStopsTheLoadingBar', async () => {
    reports.failing.add('stockHistory');
    audit.failing.add('productChanges');
    render();
    await activateTab(6);

    await chooseAnalyticsProduct(3);
    await showAnalytics();

    expectFailureBanner('productChanges is unavailable.');
  });

  /* Types into a rendered filter box, which is how a reader narrows any of the report tables. */
  async function typeFilter(value: string): Promise<void> {
    const input = host().querySelector<HTMLInputElement>('.report-filter input');
    input!.value = value;
    input!.dispatchEvent(new Event('input'));
    await settle();
  }

  it('load_requestInFlight_showsTheLoadingBar', async () => {
    reports.profitPayload = [];
    reports.holdProfit = true;
    render();
    await settle();

    // The bar is the only thing telling a reader the page is working rather than empty.
    expect(host().querySelector('mat-progress-bar')).not.toBeNull();
  });

  it('profitTab_noSupplierRows_showsEmptyStateAndOffersNoExport', async () => {
    reports.supplierPayload = [];
    render();
    await showTable(0);

    expect(host().querySelector('.export-suppliers')).toBeNull();
    expect(host().textContent).toContain('No supplier has supplied a product yet.');
  });

  it('cashFlowFilter_typedIntoTheField_narrowsTheTableAndItsExport', async () => {
    render();
    await activateTab(1);
    await showTable(1);

    await typeFilter('Gadget');

    expect(host().querySelectorAll('.cash-flow-table tbody tr').length).toBe(1);
  });

  it('cashFlowTab_noProductRows_showsEmptyStateWithNoFilterRow', async () => {
    reports.cashFlowPayload = { inflow: 0, outflow: 0, net: 0, products: [] };
    render();
    await activateTab(1);
    await showTable(1);

    expect(host().querySelector('.report-filter')).toBeNull();
    expect(host().textContent).toContain('No paid invoices in this period.');
  });

  it('cashFlowTable_deletedProduct_marksTheRow', async () => {
    reports.cashFlowPayload = {
      inflow: 1,
      outflow: 0,
      net: 1,
      products: [
        { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: true, inflow: 1, outflow: 0, net: 1 }
      ]
    };
    render();
    await activateTab(1);
    await showTable(1);

    // A row for a product that no longer exists has to say so, or the number looks unexplained.
    expect(host().querySelector('.cash-flow-table .deleted-hint')?.textContent?.trim()).toBe('deleted');
  });

  it('stockFilter_typedIntoTheField_narrowsTheTable', async () => {
    render();
    await activateTab(2);
    await showTable(2);

    await typeFilter('Gadget');

    expect(host().querySelectorAll('.stock-table tbody tr').length).toBe(1);
  });

  it('stockTab_noRows_showsEmptyStateWithNoFilterRow', async () => {
    reports.stockPayload = [];
    render();
    await activateTab(2);
    await showTable(2);

    expect(host().querySelector('.report-filter')).toBeNull();
    expect(host().textContent).toContain('No products are currently in stock.');
  });

  it('lossFilter_typedIntoTheField_narrowsTheTable', async () => {
    render();
    await activateTab(3);
    await showTable(3);

    await typeFilter('Gadget');

    expect(host().querySelectorAll('.loss-table tbody tr').length).toBe(1);
  });

  it('lossesTab_noRows_showsEmptyStateWithNoFilterRow', async () => {
    reports.lossPayload = [];
    render();
    await activateTab(3);
    await showTable(3);

    expect(host().querySelector('.report-filter')).toBeNull();
    expect(host().textContent).toContain('No losses have been recorded.');
  });

  /* Cells of the by-cause table, row by row, in column order. */
  function remarkRows(): string[][] {
    return Array.from(host().querySelectorAll('.loss-remark-table tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() ?? '')
    );
  }

  it('lossRemarkSection_rowsReturned_rendersTranslatedCausesAndFormattedValues', async () => {
    render();
    await activateTab(3);

    // Whole cells, not substrings: a cause is the entire claim the row makes about why the units
    // went, and the value is money the reader will compare against the strip above.
    expect(remarkRows()).toEqual([
      ['Expired', '1', '2', '€12.00'],
      ['In transit to customer', '3', '0', '€30.00']
    ]);
    expect(textOf('.section-title')).toBeTruthy();
    expect(host().textContent).toContain('Losses by cause');
  });

  it('lossRemarkSection_germanLanguage_readsTheGermanCause', async () => {
    render();
    await activateTab(3);

    TestBed.inject(LanguageService).setLanguage('de');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // The label comes from the movement form's key, so switching language has to move it too -
    // proof the section reuses that subtree rather than carrying its own copy.
    expect(remarkRows()[0][0]).toBe('Abgelaufen');
    expect(host().textContent).toContain('Verluste nach Ursache');
  });

  it('lossRemarkSection_showsInBothChartAndTableViews', async () => {
    render();
    await activateTab(3);

    // The tab's toggle is per tab, not per dataset, so the breakdown sits outside it and stays
    // readable whichever way the per-product half is drawn.
    expect(host().querySelector('.loss-remark-table')).not.toBeNull();

    await showTable(3);

    expect(host().querySelector('.loss-remark-table')).not.toBeNull();
  });

  it('lossRemarkSection_noRows_showsTheEmptyState', async () => {
    reports.lossRemarkPayload = [];
    render();
    await activateTab(3);

    expect(host().querySelector('.loss-remark-table')).toBeNull();
    expect(host().querySelector('.losses-remark-empty')?.textContent?.trim()).toBe(
      'No losses have been recorded.'
    );
  });

  it('lossRemarkSection_periodChange_refetchesTheBreakdownForTheSameWindow', async () => {
    render();
    await activateTab(3);
    reports.lossRemarkRanges.length = 0;
    reports.lossRanges.length = 0;

    await selectLossPeriod('d30');

    // One window, two reads: the breakdown must not drift out of step with the table above it.
    expect(reports.lossRemarkRanges).toEqual(reports.lossRanges);
    expect(reports.lossRemarkRanges).toHaveLength(1);
  });

  it('lossTable_deletedProduct_marksTheRow', async () => {
    reports.lossPayload = [
      { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: true, lostUnits: 1, destroyedUnits: 0, lossValue: 5 }
    ];
    render();
    await activateTab(3);
    await showTable(3);

    expect(host().querySelector('.loss-table .deleted-hint')?.textContent?.trim()).toBe('deleted');
  });

  it('changesFilter_typedIntoTheField_narrowsTheRows', async () => {
    render();
    await activateTab(5);

    await typeFilter('Gadget');

    expect(host().querySelectorAll('.change-row').length).toBe(1);
  });

  it('changesUserSelect_optionChosen_narrowsToThatUser', async () => {
    render();
    await activateTab(5);

    host().querySelector<HTMLElement>('.change-user-select .mat-mdc-select-trigger')?.click();
    await settle();
    document.querySelectorAll<HTMLElement>('mat-option')[1]?.click();
    await settle();

    expect(host().querySelectorAll('.change-row').length).toBe(1);
  });

  it('changesTab_noRows_showsEmptyStateWithNoFilterRow', async () => {
    audit.changePayload = [];
    render();
    await activateTab(5);

    expect(host().querySelector('.report-filter')).toBeNull();
    expect(host().textContent).toContain('No changes in this period.');
  });

  it('dueTab_bothListsEmpty_showsTheirOwnEmptyStates', async () => {
    reports.dueSoonPayload = [];
    reports.overduePayload = [];
    render();
    await activateTab(4);
    await showTable(4);

    // Two separate lists with two separate sentences: "nothing due soon" and "nothing overdue"
    // are different pieces of news.
    expect(host().textContent).toContain('No invoices fall due in the coming week.');
    expect(host().textContent).toContain('No invoice is overdue.');
  });

  it('profitRow_enterKey_opensTheDetailDialogToo', async () => {
    render();
    await showTable(0);

    // The rows are focusable, so the keyboard has to reach the same detail a click does.
    host()
      .querySelector('.profit-row')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();

    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  it('cashFlowSupplierField_selectionEmitted_narrowsTheProductSearchScope', async () => {
    render();
    await activateTab(1);

    typeaheadAt('.cash-flow-supplier-search').selected.emit({
      id: 5,
      name: 'Acme',
      address: '1 Main St',
      createdAt: ''
    } as never);
    await settle();

    typeaheadAt('.cash-flow-product-search').search()('wid').subscribe();
    expect(reports.supplierProductTerms).toEqual(['wid']);
  });

  it('analyticsSupplierField_selectionEmitted_enablesTheProductField', async () => {
    render();
    await activateTab(6);
    expect(host().querySelector<HTMLInputElement>('.analytics-product-search input')?.disabled).toBe(true);

    typeaheadAt('.analytics-supplier-search').selected.emit({
      id: 5,
      name: 'Acme',
      address: '1 Main St',
      createdAt: ''
    } as never);
    await settle();

    expect(host().querySelector<HTMLInputElement>('.analytics-product-search input')?.disabled).toBe(false);
  });

  it('supplierSearch_typed_queriesTheSupplierServiceAndLabelsTheRows', async () => {
    render();
    await activateTab(6);
    const field = typeaheadAt('.analytics-supplier-search') as unknown as TypeaheadComponent<SupplierResponse>;

    field.search()('acm').subscribe();

    expect(suppliers.terms).toEqual(['acm']);
    // The panel shows names, not ids: the label function is what makes the list readable.
    expect(field.displayWith()({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' })).toBe('Acme');
  });

  it('productSearch_panelRows_areLabelledByProductName', async () => {
    render();
    await activateTab(6);

    expect(typeaheadAt('.analytics-product-search').displayWith()(productRow(3))).toBe('Product 3');
  });

  it('period_year_computesTheCalendarYearToDateRange', async () => {
    vi.setSystemTime(new Date(2026, 5, 15, 12));
    render();

    await selectProfitPeriod('year');

    // From 1 January of the current year, not 365 days back: "this year" is a calendar claim.
    expect(reports.profitRanges['products'].at(-1)).toEqual(['2026-01-01', '2026-06-15']);
  });

  it('dueChart_noBuckets_rendersEmptyStateInsteadOfAnEmptyChart', async () => {
    reports.buckets = [];
    render();

    await activateTab(4);

    expect(optionOf('dueOption')).toBeNull();
    expect(host().textContent).toContain('No invoices are currently outstanding.');
  });

  it('analyticsChart_noStockHistory_rendersEmptyStateInsteadOfAnEmptyChart', async () => {
    reports.stockHistoryPayload = [];
    render();
    await activateTab(6);

    await chooseAnalyticsProduct(3);
    await showAnalytics();

    expect(optionOf('analyticsStockOption')).toBeNull();
  });

  it('overdueRow_withoutADayCount_omitsTheLateChip', async () => {
    reports.overduePayload = [{ ...OVERDUE[0], daysOverdue: null }];
    render();
    await activateTab(4);
    await showTable(4);

    // The chip is the count; with no count there is nothing to show rather than "null days late".
    expect(host().querySelector('.overdue-row .days-overdue')).toBeNull();
  });

  it('cashFlowTab_queryFails_reportsItAndLeavesNoTable', async () => {
    reports.failing.add('cashFlow');
    render();

    await activateTab(1);
    await showTable(1);

    // The report signal stays null, so the table falls back to no rows rather than throwing.
    expect(host().querySelector('.reports-error')?.textContent?.trim()).toBe('cashFlow is unavailable.');
    expect(host().querySelector('.cash-flow-table')).toBeNull();
  });

  it('changesTab_periodChangedWithTheSelectedUserStillPresent_keepsTheSelection', async () => {
    render();
    await activateTab(5);
    host().querySelector<HTMLElement>('.change-user-select .mat-mdc-select-trigger')?.click();
    await settle();
    document.querySelectorAll<HTMLElement>('mat-option')[1]?.click();
    await settle();

    await selectChangePeriod('d30');

    // The account is still in the narrower window, so the filter must survive the refetch.
    expect(host().querySelectorAll('.change-row').length).toBe(1);
  });

  it('exportSuppliers_clicked_downloadsTheSupplierTable', async () => {
    render();
    await showTable(0);

    host().querySelector<HTMLButtonElement>('.export-suppliers')?.click();

    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][0]).toBe('profit-suppliers.csv');
  });
});

interface SeriesProbe {
  series?: { data?: { value?: number }[] }[];
}

/*
 * The formatting callbacks an option carries. Typed loosely on purpose: these mirror the parts of
 * echarts' own option shape the value specs invoke, and importing its types here would tie the
 * spec to a structure only ChartComponent is supposed to know.
 */
interface FormatProbe {
  tooltip?: { valueFormatter?: (value: unknown) => string };
  xAxis?: { data?: string[]; axisLabel?: { formatter?: (value: string | number) => string } };
  yAxis?: { axisLabel?: { formatter?: (value: number) => string } };
  series?: { detail?: { formatter?: (value: number) => string } }[];
}
