import { BreakpointObserver } from '@angular/cdk/layout';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import {
  DueDateBucket,
  InvoiceDueSummary,
  LossReport,
  PaginatedProducts,
  ProductProfitReport,
  ProductResponse
} from '../../core/api/api-models';
import { HealthProbe, HealthService } from '../../core/health/health.service';
import { LANGUAGE_STORAGE_KEY } from '../../core/i18n/language.service';
import { ChartComponent } from '../../shared/chart/chart.component';
import { BreakpointObserverStub } from '../../testing/breakpoint-testing';
import { provideFakeChartEngine } from '../../testing/chart-testing';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { ProductService } from '../products/product.service';
import { ReportService } from '../reports/report.service';
import { DashboardComponent } from './dashboard.component';
import { DueCardComponent } from './due-card/due-card.component';
import { ProfitCardComponent } from './profit-card/profit-card.component';

/*
 * Response fixtures shared by this feature's specs, held here under the shared-fixture rule
 * because two or more spec files consume them. A fixture stays in its own spec file until a
 * second file needs the identical value.
 *
 * Constants, pure builder functions, and the TestBed configuration the specs share. No
 * beforeEach, afterEach, or any other hook registration belongs in this file: hooks registered
 * outside a describe block have been observed not to run for every spec under coverage, so a
 * hook placed here would silently protect nothing. Nor does any `vi.*` call: this module is
 * outside tsconfig.spec.json's include, so the runner's globals are not declared for it, and
 * timer handling stays in each spec file for that reason.
 */
export const WIDGET: ProductResponse = {
  id: 3,
  name: 'Widget',
  sku: 'SKU-3',
  quantity: 2,
  purchasePrice: 15,
  totalValue: 30,
  createdAt: '2026-01-02T03:04:00'
};

export const TRANSLATIONS = {
  // Only the remainder label in German: it is the one chart string the language spec reads.
  de: { charts: { other: 'Sonstige' } },
  en: {
    charts: { other: 'Other' },
    reports: { view: { chart: 'Chart', table: 'Table' }, columns: { name: 'Name', grossProfit: 'Gross profit' } },
    common: { errors: { serverError: 'A server error occurred. Please try again later.' } },
    dashboard: {
      title: 'Dashboard',
      refresh: 'Refresh',
      kpi: {
        products: 'Products',
        lowStock: 'Low stock',
        overdue: 'Overdue invoices',
        grossProfit: 'Gross profit'
      },
      lowStockTitle: 'Low stock',
      lowStockNone: 'All products are sufficiently stocked.',
      charts: { profitByProduct: 'Profit by product', dueDates: 'Upcoming due dates' }
    }
  }
};

// pageSize 1 with totalElements 42: the count must come from the envelope, not the payload.
export const PAGE: PaginatedProducts = {
  content: [WIDGET],
  pageNumber: 0,
  pageSize: 1,
  totalElements: 42,
  totalPages: 42
};

export const LOSSES: LossReport[] = [
  {
    productId: 3,
    name: 'Widget',
    sku: 'SKU-3',
    deleted: false,
    lostUnits: 2,
    destroyedUnits: 1,
    lossValue: 15
  },
  {
    productId: 4,
    name: 'Gadget',
    sku: 'SKU-4',
    deleted: false,
    lostUnits: 1,
    destroyedUnits: 0,
    lossValue: 5
  }
];

export const OVERDUE: InvoiceDueSummary[] = [
  {
    invoiceId: 1,
    invoiceNumber: 'RE-2026-0001',
    invoiceType: 'SALE',
    counterparty: 'Jane Doe',
    dueDate: '2026-03-01',
    outstandingValue: 30,
    daysOverdue: 5
  },
  {
    invoiceId: 2,
    invoiceNumber: 'RE-2026-0002',
    invoiceType: 'PURCHASE',
    counterparty: 'Acme',
    dueDate: '2026-03-02',
    outstandingValue: 10,
    daysOverdue: 2
  },
  {
    invoiceId: 3,
    invoiceNumber: 'RE-2026-0003',
    invoiceType: 'SALE',
    counterparty: 'John Roe',
    dueDate: '2026-03-03',
    outstandingValue: 20,
    daysOverdue: 1
  }
];

export const PROFIT: ProductProfitReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, revenue: 100, cost: 40, grossProfit: 60 },
  { productId: 4, name: 'Gadget', sku: 'SKU-4', deleted: false, revenue: 60, cost: 35, grossProfit: 25 }
];

/* Eleven products, so topNWithRemainder has a remainder to bucket. */
export const MANY_PROFIT: ProductProfitReport[] = Array.from({ length: 11 }, (unused, index) => ({
  productId: index + 1,
  name: 'Product ' + index,
  sku: 'SKU-' + index,
  deleted: false,
  revenue: 100,
  cost: 40,
  grossProfit: 60 - index
}));

/* Nine rows, so the list's cap at eight is observable rather than incidental. */
export const DUE_SOON: InvoiceDueSummary[] = Array.from({ length: 9 }, (unused, index) => ({
  invoiceId: index + 1,
  invoiceNumber: 'RE-2026-100' + index,
  invoiceType: index % 2 === 0 ? 'SALE' : 'PURCHASE',
  counterparty: 'Customer ' + index,
  dueDate: '2026-03-0' + ((index % 9) + 1),
  outstandingValue: 100 + index,
  daysOverdue: null
}));

export const BUCKETS: DueDateBucket[] = [
  { dueDate: '2026-03-01', invoiceType: 'SALE', invoiceCount: 2, totalValue: 60 }
];

export class ReportServiceStub {
  calls = 0;
  profitPayload: ProductProfitReport[] = PROFIT;

  /*
   * Set by holdDashboardSources to keep a source in flight. Null by default, so every spec that
   * does not ask for it keeps the synchronous answer it was written against.
   */
  profitGate: Subject<ProductProfitReport[]> | null = null;
  dueDatesGate: Subject<DueDateBucket[]> | null = null;
  overdueGate: Subject<InvoiceDueSummary[]> | null = null;

  profitProducts(): Observable<ProductProfitReport[]> {
    this.calls += 1;
    return this.profitGate ?? of(this.profitPayload);
  }

  dueDates(): Observable<DueDateBucket[]> {
    this.calls += 1;
    return this.dueDatesGate ?? of(BUCKETS);
  }

  /* Still offered, and deliberately counted: the dashboard must no longer ask for it. */
  lossRequests = 0;

  losses(): Observable<LossReport[]> {
    this.calls += 1;
    this.lossRequests += 1;
    return of(LOSSES);
  }

  overdue(): Observable<InvoiceDueSummary[]> {
    this.calls += 1;
    return this.overdueGate ?? of(OVERDUE);
  }

  /* Counted separately: the due list must fetch these only when it is actually opened. */
  dueSoonRequests = 0;

  dueSoon(): Observable<InvoiceDueSummary[]> {
    this.calls += 1;
    this.dueSoonRequests += 1;
    return of(DUE_SOON);
  }
}

export class ProductServiceStub {
  lowStockRows: ProductResponse[] = [WIDGET];
  /* Counts fetches, so opening the dialog can be shown to reuse the rows rather than reload them. */
  lowStockCalls = 0;
  /* Set to make the paged call fail, which is what puts the component into its error state. */
  pagedFailure: Error | null = null;

  /* As on the report stub: null unless a spec asks for the source to be held open. */
  pagedGate: Subject<PaginatedProducts> | null = null;
  lowStockGate: Subject<ProductResponse[]> | null = null;

  getPagedProducts(): Observable<PaginatedProducts> {
    if (this.pagedGate) {
      return this.pagedGate;
    }
    return this.pagedFailure ? throwError(() => this.pagedFailure) : of(PAGE);
  }

  lowStock(): Observable<ProductResponse[]> {
    this.lowStockCalls++;
    return this.lowStockGate ?? of(this.lowStockRows);
  }
}

/* The established dialog stub, recording what was opened and with what data. */
export class MatDialogStub {
  openCalls: { component: unknown; config?: { data?: unknown } }[] = [];

  open(component: unknown, config?: { data?: unknown }) {
    this.openCalls.push({ component, config });
    return { afterClosed: () => of(undefined) };
  }
}

/* Counts calls, so a test can prove the dashboard itself no longer polls health. */
export class HealthServiceStub {
  checks = 0;

  check(): Observable<HealthProbe> {
    this.checks++;
    return of({ up: true, latencyMs: 12 });
  }
}

/*
 * The formatting callbacks an option carries. Typed loosely on purpose: it mirrors the parts of
 * echarts' own option shape these specs invoke, and importing its types would tie the spec to a
 * structure only ChartComponent is supposed to know.
 */
export interface FormatProbe {
  tooltip?: { valueFormatter?: (value: unknown) => string };
  xAxis?: { data?: string[]; axisLabel?: { formatter?: (value: string | number) => string } };
  yAxis?: { axisLabel?: { formatter?: (value: number) => string } };
}

/** The five stubs a spec drives the dashboard through. */
export interface DashboardStubs {
  reports: ReportServiceStub;
  products: ProductServiceStub;
  health: HealthServiceStub;
  dialog: MatDialogStub;
  breakpoints: BreakpointObserverStub;
}

/**
 * Configures the TestBed every dashboard spec builds the page through, and answers with the
 * stubs it was wired with.
 *
 * <p>One function rather than a copy per spec file, so the runner sees one context configuration
 * across all of them: a difference here would fork the compilation the specs share.
 *
 * <p>Timers are not touched here. They are the runner's, and this file is compiled without the
 * runner's types, so each spec fakes them itself before calling this.
 */
export function configureDashboardTestBed(): DashboardStubs {
  // The entry clear for all three consumers of this fixture, which is how each of them meets the
  // storage-isolation rule without repeating it.
  localStorage.clear();
  // Pinned for the same reason the customer-summary spec pins it: LanguageService resolves from
  // storage first, so a currency assertion here would otherwise depend on spec file order.
  localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
  TestBed.resetTestingModule();
  const stubs: DashboardStubs = {
    reports: new ReportServiceStub(),
    products: new ProductServiceStub(),
    health: new HealthServiceStub(),
    dialog: new MatDialogStub(),
    // Pinned to desktop so every assertion below sees one fixed tier; jsdom applies no media
    // queries, so the real observer would answer whatever matchMedia stubs out to.
    breakpoints: new BreakpointObserverStub(true)
  };

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTestTranslations(TRANSLATIONS),
      { provide: BreakpointObserver, useValue: stubs.breakpoints },
      { provide: ReportService, useValue: stubs.reports },
      { provide: ProductService, useValue: stubs.products },
      { provide: HealthService, useValue: stubs.health },
      { provide: MatDialog, useValue: stubs.dialog },
      // The real ChartComponent renders, drawing through a fake engine. Swapping the component
      // out with overrideComponent instead forces a runtime recompile whose template is no
      // longer attributed to dashboard.component.html, which reported it at 0% coverage while
      // these specs were rendering and asserting on it (#142).
      provideFakeChartEngine()
    ]
  });

  return stubs;
}

export function host(fixture: ComponentFixture<DashboardComponent>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

export function textOf(fixture: ComponentFixture<DashboardComponent>, selector: string): string {
  return host(fixture).querySelector(selector)?.textContent ?? '';
}

/* The due card instance, which owns the view toggle the dashboard used to hold. */
export function dueCard(
  fixture: ComponentFixture<DashboardComponent>
): { setDueView: (view: string) => void; dueDateOption: () => FormatProbe } {
  return fixture.debugElement.query(By.directive(DueCardComponent)).componentInstance;
}

/* The profit card instance, for the same reason. */
export function profitCard(
  fixture: ComponentFixture<DashboardComponent>
): { setProfitView: (view: string) => void; profitOption: () => FormatProbe } {
  return fixture.debugElement.query(By.directive(ProfitCardComponent)).componentInstance;
}

/* Flips the due card to its list half, the way the toggle group does. */
export function showDueList(fixture: ComponentFixture<DashboardComponent>): void {
  dueCard(fixture).setDueView('table');
  fixture.detectChanges();
}

/* Returns the due card to its chart half. */
export function showDueChart(fixture: ComponentFixture<DashboardComponent>): void {
  dueCard(fixture).setDueView('chart');
  fixture.detectChanges();
}

/* Flips the profit card to its table half, the way the toggle group does. */
export function showProfitTable(fixture: ComponentFixture<DashboardComponent>): void {
  profitCard(fixture).setProfitView('table');
  fixture.detectChanges();
}

/* The four KPI values in template order: products, low stock, overdue, loss value. */
export function kpiValues(fixture: ComponentFixture<DashboardComponent>): string[] {
  return Array.from(host(fixture).querySelectorAll('.kpi-card .kpi-value')).map((element) =>
    (element.textContent ?? '').trim()
  );
}

/* The height each rendered chart was handed, in template order. */
export function chartHeights(fixture: ComponentFixture<DashboardComponent>): string[] {
  return fixture.debugElement
    .queryAll(By.directive(ChartComponent))
    .map((chart) => (chart.componentInstance as ChartComponent).height());
}

/** The five sources held open by holdDashboardSources, each released or failed on demand. */
export interface DashboardGates {
  releaseProducts(): void;
  releaseLowStock(): void;
  releaseOverdue(): void;
  releaseProfit(): void;
  releaseDueDates(): void;
  failProducts(error: Error): void;
}

/**
 * Replaces every dashboard source with a subject that answers only when it is released.
 *
 * <p>The stubs answer synchronously by default, which means a rendered dashboard has already
 * finished loading by the time a spec can look at it - the loading state would be unobservable.
 * Holding the sources open is what makes the interval between the request and the answer long
 * enough to assert on, and releasing them one at a time is what shows that each figure waits on
 * its own request rather than on the slowest of the five.
 *
 * <p>Must be called before the component is created, since the subscriptions happen in ngOnInit.
 */
export function holdDashboardSources(stubs: DashboardStubs): DashboardGates {
  const products = new Subject<PaginatedProducts>();
  const lowStock = new Subject<ProductResponse[]>();
  const overdue = new Subject<InvoiceDueSummary[]>();
  const profit = new Subject<ProductProfitReport[]>();
  const dueDates = new Subject<DueDateBucket[]>();

  stubs.products.pagedGate = products;
  stubs.products.lowStockGate = lowStock;
  stubs.reports.overdueGate = overdue;
  stubs.reports.profitGate = profit;
  stubs.reports.dueDatesGate = dueDates;

  return {
    releaseProducts: () => {
      products.next(PAGE);
      products.complete();
    },
    releaseLowStock: () => {
      lowStock.next(stubs.products.lowStockRows);
      lowStock.complete();
    },
    releaseOverdue: () => {
      overdue.next(OVERDUE);
      overdue.complete();
    },
    releaseProfit: () => {
      profit.next(stubs.reports.profitPayload);
      profit.complete();
    },
    releaseDueDates: () => {
      dueDates.next(BUCKETS);
      dueDates.complete();
    },
    failProducts: (error: Error) => products.error(error)
  };
}

/* The placeholders currently on screen, by the card each one stands in. */
export function skeletons(fixture: ComponentFixture<DashboardComponent>): string[] {
  return Array.from(host(fixture).querySelectorAll('.skeleton')).map(
    (element) => element.className
  );
}

/* Whether one card carries a placeholder, addressed the way a reader meets it - by its card. */
export function hasSkeleton(
  fixture: ComponentFixture<DashboardComponent>,
  card: string
): boolean {
  return host(fixture).querySelector(`${card} .skeleton`) !== null;
}

/* Whether one card announces itself as still loading to a screen reader. */
export function isBusy(fixture: ComponentFixture<DashboardComponent>, card: string): boolean {
  return host(fixture).querySelector(card)?.getAttribute('aria-busy') === 'true';
}
