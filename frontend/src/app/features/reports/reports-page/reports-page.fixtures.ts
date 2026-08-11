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
import { TypeaheadComponent } from '../../../shared/typeahead/typeahead.component';
import { provideFakeChartEngine } from '../../../testing/chart-testing';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { AuditService } from '../../audit/audit.service';
import { SupplierService } from '../../suppliers/supplier.service';
import { ReportService } from '../report.service';
import { ReportsPageComponent } from './reports-page.component';

/*
 * Payloads, service stubs and page-driving helpers shared by the reports-page specs, held here
 * under the shared-fixture rule because two or more spec files consume each of them. A fixture
 * stays in its own spec file until a second file needs the identical value.
 *
 * Constants, stub classes and pure builder functions only. No beforeEach, afterEach, or any other
 * hook registration belongs in this file: hooks registered outside a describe block have been
 * observed not to run for every spec under coverage, so a hook placed here would silently protect
 * nothing. For the same structural reason nothing here calls `vi` or `expect` - this file is
 * compiled by the app project, which carries no test-runner types.
 *
 * The page-driving helpers are built by a factory rather than exported directly, because they need
 * the fixture the calling spec is holding. Each spec keeps that `let` in its own scope, as it did
 * when these helpers lived beside the tests, and hands this file a getter and a setter for it -
 * so nothing mutable is shared between spec files through this module.
 */

export const TRANSLATIONS = {
  en: {
    common: { search: { noMatches: 'No matches' } },
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
      search: { supplier: 'Search supplier', product: 'Search product' },
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

export const PROFIT: ProductProfitReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, revenue: 200, cost: 150, grossProfit: 50 },
  { productId: 4, name: 'Gadget', sku: 'SKU-4', deleted: true, revenue: 200, cost: 150, grossProfit: 50 }
];

export const SUPPLIERS: SupplierProfitReport[] = [
  { supplierId: 7, name: 'Acme', revenue: 400, cost: 300, grossProfit: 100 }
];

export const STOCK: StockStatusReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', soldUnits: 4, soldRevenue: 60, inStockUnits: 6, inStockValue: 30 },
  // A second row sharing no substring with the first, so a filter test proves narrowing and a
  // totals test proves summing rather than echoing one row.
  { productId: 4, name: 'Gadget', sku: 'ABC-4', soldUnits: 1, soldRevenue: 10, inStockUnits: 4, inStockValue: 20 }
];

export const LOSSES: LossReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, lostUnits: 2, destroyedUnits: 1, lossValue: 15 },
  { productId: 4, name: 'Gadget', sku: 'ABC-4', deleted: false, lostUnits: 3, destroyedUnits: 4, lossValue: 25 }
];

/* The same write-offs LOSSES holds, grouped by cause instead of by product. */
export const LOSSES_BY_REMARK: LossByRemark[] = [
  { remark: 'EXPIRED', lostUnits: 1, destroyedUnits: 2, lossValue: 12 },
  { remark: 'IN_TRANSIT_TO_CUSTOMER', lostUnits: 3, destroyedUnits: 0, lossValue: 30 }
];

export const BUCKETS: DueDateBucket[] = [
  { dueDate: '2026-03-01', invoiceType: 'SALE', invoiceCount: 2, totalValue: 60 }
];

export const DUE_SOON: InvoiceDueSummary[] = [
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

export const OVERDUE: InvoiceDueSummary[] = [
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

export const CASH_FLOW: CashFlowReport = {
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

export const TIMELINE: CashFlowTimelineBucket[] = [
  { month: '2026-02', inflow: 0, outflow: 300, net: -300 },
  { month: '2026-03', inflow: 500, outflow: 0, net: 500 }
];

export const CHANGES: ChangeLogEntryResponse[] = [
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
export const PRODUCT_CHANGES: ChangeLogResponse[] = [
  { id: 4, productId: 3, userId: 11, field: 'PURCHASE_PRICE', oldValue: '12.00', newValue: '14.00',
    createdAt: '2026-03-14T10:00:00' },
  { id: 3, productId: 3, userId: 11, field: 'NAME', oldValue: 'Old', newValue: 'Widget',
    createdAt: '2026-03-13T10:00:00' },
  { id: 2, productId: 3, userId: 11, field: 'PURCHASE_PRICE', oldValue: '10.00', newValue: '12.00',
    createdAt: '2026-03-12T10:00:00' }
];

export const STOCK_HISTORY: StockHistoryPoint[] = [
  { date: '2026-03-12', stockLevel: 40, cumulativeSoldUnits: 0 },
  { date: '2026-03-14', stockLevel: 32, cumulativeSoldUnits: 8 }
];

/* The supplier typeahead's source; the page never sends the supplier, only searches within it. */
export class SupplierServiceStub {
  terms: string[] = [];
  payload: SupplierResponse[] = [
    { id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '2026-01-02T03:04:00' }
  ];

  search(name: string): Observable<SupplierResponse[]> {
    this.terms.push(name);
    return of(this.payload);
  }
}

export class AuditServiceStub {
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

export class ReportServiceStub {
  /* Endpoints that must reject, so each tab's error path can be driven by name. */
  readonly failing = new Set<string>();

  /* Rejects when the endpoint is in this stub's own `failing` set, otherwise answers with the
     payload. */
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

export interface SeriesProbe {
  series?: { data?: { value?: number }[] }[];
}

/** The three stubs a spec drives the page through. */
export interface ReportsPageStubs {
  reports: ReportServiceStub;
  audit: AuditServiceStub;
  suppliers: SupplierServiceStub;
}

/* A row of the shape the supplier-scoped product search answers with. */
export function productRow(id: number): SupplierProduct {
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

/**
 * Configures the TestBed every reports-page spec builds the page through, and answers with the
 * stubs it was wired with.
 *
 * <p>One function rather than a copy per spec file, so the runner sees one context configuration
 * across all of them: a difference here would fork the compilation the specs share.
 *
 * <p>`dialog` and `download` are passed in rather than built here, because both are test doubles
 * from the runner and this file is compiled without the runner's types.
 */
export function configureReportsPageTestBed(dialog: unknown, download: unknown): ReportsPageStubs {
  // Each file owns its start state: the clear in global-test-setup.ts does not reliably run under
  // coverage in a shared worker, as documented there. FormatService and LanguageService read storage
  // at construction, so residue from an earlier file changes what currency and dates render.
  localStorage.clear();
  TestBed.resetTestingModule();
  const stubs: ReportsPageStubs = {
    reports: new ReportServiceStub(),
    audit: new AuditServiceStub(),
    suppliers: new SupplierServiceStub()
  };

  TestBed.configureTestingModule({
    providers: [
      // MatTabBody only attaches a tab body once its transition reports done, and jsdom fires
      // no transition events. Material's own token disables them without pulling in
      // @angular/animations, which this project does not depend on.
      { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      provideRouter([]),
      provideTestTranslations(TRANSLATIONS),
      { provide: ReportService, useValue: stubs.reports },
      { provide: AuditService, useValue: stubs.audit },
      { provide: SupplierService, useValue: stubs.suppliers },
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

  return stubs;
}

/**
 * Builds the helpers that drive a rendered reports page.
 *
 * @param getFixture reads the fixture the calling spec is holding
 * @param setFixture hands a newly rendered fixture back to it
 */
export function createReportsPageHelpers(
  getFixture: () => ComponentFixture<ReportsPageComponent>,
  setFixture: (value: ComponentFixture<ReportsPageComponent>) => void
) {
  function render(): void {
    const created = TestBed.createComponent(ReportsPageComponent);
    setFixture(created);
    created.detectChanges();
  }

  function host(): HTMLElement {
    return getFixture().nativeElement as HTMLElement;
  }

  function textOf(selector: string): string {
    return host().querySelector(selector)?.textContent ?? '';
  }

  async function settle(): Promise<void> {
    const fixture = getFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /* Flips a tab to its table half, which is what the chart/table toggle exists to do. */
  async function showTable(tab: number): Promise<void> {
    const page = getFixture().componentInstance as unknown as {
      setView: (tab: number, view: 'chart' | 'table') => void;
    };
    page.setView(tab, 'table');
    await settle();
  }

  /*
   * Drives the tab group through the component's own handler and waits for the tab body to
   * attach, which MatTabGroup defers past the first change-detection pass.
   */
  async function activateTab(index: number): Promise<void> {
    const page = getFixture().componentInstance as unknown as { activate: (i: number) => void };
    page.activate(index);
    await settle();
  }

  /* Reads a chart option straight off the component; the stub renders nothing to assert on. */
  function optionOf(name: string): SeriesProbe | null {
    const probe = getFixture().componentInstance as unknown as Record<string, () => SeriesProbe | null>;
    return probe[name]();
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
    return getFixture().componentInstance as never;
  }

  /*
   * The typeahead the page put at this selector, reached as a component so the spec can call the
   * `[search]` function the template bound and emit the `(selected)` output the template listens to.
   *
   * <p>Typing into the field instead would wait out the typeahead's debounce on a real timer, and
   * this spec fakes only `Date`. What is under test here is the binding, not the debounce, which
   * the typeahead's own spec already owns.
   */
  function typeaheadAt(selector: string): TypeaheadComponent<SupplierProduct> {
    return getFixture().debugElement
      .query(By.css(selector))
      .componentInstance as TypeaheadComponent<SupplierProduct>;
  }

  /* Types into one of the tabs' filters through the component, the way its input does. */
  async function setFilter(method: string, value: string): Promise<void> {
    const target = getFixture().componentInstance as unknown as Record<string, (value: string) => void>;
    target[method](value);
    await settle();
  }

  /*
   * Types into a rendered filter box, which is how a reader narrows any of the report tables.
   *
   * <p>The selector is unscoped and still deterministic, on a premise worth stating: MatTabGroup
   * attaches one tab body at a time, so exactly one filter box is in the DOM whichever tab the
   * caller activated. A second attached body would make this the first of two, and the helper would
   * need the tab to scope by.
   */
  async function typeFilter(value: string): Promise<void> {
    const input = host().querySelector<HTMLInputElement>('.report-filter input');
    input!.value = value;
    input!.dispatchEvent(new Event('input'));
    await settle();
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

  return {
    render, host, textOf, settle, showTable, activateTab, optionOf, page, typeaheadAt,
    setFilter, typeFilter, sortBy, columnText, chooseAnalyticsProduct, showAnalytics
  };
}
