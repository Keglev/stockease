import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import {
  DueDateBucket,
  InvoiceDueSummary,
  LossReport,
  PaginatedProducts,
  ProductProfitReport,
  ProductResponse
} from '../../core/api/api-models';
import { HealthProbe, HealthService } from '../../core/health/health.service';
import { ChartComponent, ChartOption } from '../../shared/chart/chart.component';
import { BreakpointObserverStub } from '../../testing/breakpoint-testing';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { ProductService } from '../products/product.service';
import { ReportService } from '../reports/report.service';
import { DashboardComponent } from './dashboard.component';

const TRANSLATIONS = {
  en: {
    charts: { other: 'Other' },
    reports: { view: { chart: 'Chart', table: 'Table' }, columns: { name: 'Name', grossProfit: 'Gross profit' } },
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
      charts: { profitByProduct: 'Profit by product', dueDates: 'Upcoming due dates' },
      health: {
        title: 'API status',
        up: 'Available',
        down: 'Unavailable',
        latency: 'API response time: {{ms}} ms',
        lastChecked: 'Last checked at {{time}}'
      }
    }
  }
};

const WIDGET: ProductResponse = {
  id: 3,
  name: 'Widget',
  sku: 'SKU-3',
  quantity: 2,
  purchasePrice: 15,
  totalValue: 30,
  createdAt: '2026-01-02T03:04:00'
};

// pageSize 1 with totalElements 42: the count must come from the envelope, not the payload.
const PAGE: PaginatedProducts = {
  content: [WIDGET],
  pageNumber: 0,
  pageSize: 1,
  totalElements: 42,
  totalPages: 42
};

const LOSSES: LossReport[] = [
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

const OVERDUE: InvoiceDueSummary[] = [
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

const PROFIT: ProductProfitReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, revenue: 100, cost: 40, grossProfit: 60 },
  { productId: 4, name: 'Gadget', sku: 'SKU-4', deleted: false, revenue: 60, cost: 35, grossProfit: 25 }
];

/** Eleven products, so topNWithRemainder has a remainder to bucket. */
const MANY_PROFIT: ProductProfitReport[] = Array.from({ length: 11 }, (unused, index) => ({
  productId: index + 1,
  name: 'Product ' + index,
  sku: 'SKU-' + index,
  deleted: false,
  revenue: 100,
  cost: 40,
  grossProfit: 60 - index
}));

const BUCKETS: DueDateBucket[] = [
  { dueDate: '2026-03-01', invoiceType: 'SALE', invoiceCount: 2, totalValue: 60 }
];

/** Stands in for the ECharts wrapper: jsdom has no canvas and the wrapper has its own spec. */
@Component({ selector: 'app-chart', template: '' })
class ChartStubComponent {
  readonly option = input.required<ChartOption>();
  readonly height = input('20rem');
}

class ReportServiceStub {
  calls = 0;
  profitPayload: ProductProfitReport[] = PROFIT;

  profitProducts(): Observable<ProductProfitReport[]> {
    this.calls += 1;
    return of(this.profitPayload);
  }

  dueDates(): Observable<DueDateBucket[]> {
    this.calls += 1;
    return of(BUCKETS);
  }

  /** Still offered, and deliberately counted: the dashboard must no longer ask for it. */
  lossRequests = 0;

  losses(): Observable<LossReport[]> {
    this.calls += 1;
    this.lossRequests += 1;
    return of(LOSSES);
  }

  overdue(): Observable<InvoiceDueSummary[]> {
    this.calls += 1;
    return of(OVERDUE);
  }
}

class ProductServiceStub {
  lowStockRows: ProductResponse[] = [WIDGET];
  /** Set to make the paged call fail, which is what puts the component into its error state. */
  pagedFailure: Error | null = null;

  getPagedProducts(): Observable<PaginatedProducts> {
    return this.pagedFailure ? throwError(() => this.pagedFailure) : of(PAGE);
  }

  lowStock(): Observable<ProductResponse[]> {
    return of(this.lowStockRows);
  }
}

class HealthServiceStub {
  probe: HealthProbe = { up: true, latencyMs: 12 };

  check(): Observable<HealthProbe> {
    return of(this.probe);
  }
}

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let reports: ReportServiceStub;
  let products: ProductServiceStub;
  let health: HealthServiceStub;
  let breakpoints: BreakpointObserverStub;

  /**
   * The app is zoneless, so fakeAsync is unavailable and vitest's timers stand in for the
   * health poll's rxjs timer. They must be faked before the component subscribes.
   */
  function render(): void {
    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    fixture.detectChanges();
  }

  function textOf(selector: string): string {
    return (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent ?? '';
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** Flips the profit card to its table half, the way the toggle group does. */
  function showProfitTable(): void {
    const page = fixture.componentInstance as unknown as { setProfitView: (view: string) => void };
    page.setProfitView('table');
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
    reports = new ReportServiceStub();
    products = new ProductServiceStub();
    health = new HealthServiceStub();
    // Pinned to desktop so every assertion below sees one fixed tier; jsdom applies no media
    // queries, so the real observer would answer whatever matchMedia stubs out to.
    breakpoints = new BreakpointObserverStub(true);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTestTranslations(TRANSLATIONS),
        { provide: BreakpointObserver, useValue: breakpoints },
        { provide: ReportService, useValue: reports },
        { provide: ProductService, useValue: products },
        { provide: HealthService, useValue: health }
      ]
    });
    TestBed.overrideComponent(DashboardComponent, {
      remove: { imports: [ChartComponent] },
      add: { imports: [ChartStubComponent] }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ngOnInit_pagedEnvelope_showsTotalElementsAsProductCount', () => {
    render();

    // The count is the envelope's totalElements, not the length of the one-row payload.
    expect(textOf('.kpi-products .kpi-value')).toContain('42');
  });

  it('kpi_profitRows_sumsGrossProfit', () => {
    render();

    // summed over every row the profit report returned, not over the ten the chart plots
    expect(textOf('.kpi-gross-profit .kpi-value')).toContain('85.00');
  });

  it('kpi_negativeProfitSum_rendersErrorColorClass', () => {
    reports.profitPayload = [{ ...PROFIT[0], grossProfit: -40 }];
    render();

    // the class, not the computed colour: jsdom resolves no tokens
    expect(host().querySelector('.kpi-gross-profit .kpi-negative')).not.toBeNull();
  });

  it('kpi_positiveProfitSum_omitsErrorColorClass', () => {
    render();

    // the other direction, so the assertion above cannot pass on an always-present class
    expect(host().querySelector('.kpi-gross-profit .kpi-value')).not.toBeNull();
    expect(host().querySelector('.kpi-gross-profit .kpi-negative')).toBeNull();
  });

  it('ngOnInit_overdueInvoices_showsRowCount', () => {
    render();

    expect(textOf('.kpi-overdue .kpi-value').trim()).toBe('3');
  });

  it('ngOnInit_lowStockProducts_showsCountKpi', () => {
    render();

    expect(textOf('.kpi-low-stock .kpi-value').trim()).toBe('1');
  });

  it('lowStockAlert_productsBelowThreshold_rendersOneRowPerProduct', () => {
    render();

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.low-stock-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Widget');
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/app/products');
  });

  it('lowStockAlert_noLowStock_rendersAllClearLine', () => {
    products.lowStockRows = [];
    render();

    expect((fixture.nativeElement as HTMLElement).querySelector('.low-stock-row')).toBeNull();
    expect(textOf('.low-stock-none')).toContain('All products are sufficiently stocked.');
  });

  it('refresh_clicked_reinvokesEveryReportLoad', () => {
    render();
    const afterInit = reports.calls;

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.dashboard-refresh')
      ?.click();
    fixture.detectChanges();

    // three, not four: the loss report left the dashboard with the KPI it fed
    expect(afterInit).toBe(3);
    expect(reports.calls).toBe(afterInit * 2);
  });

  it('healthCard_probeUp_showsUpLabelAndMeasuredLatency', () => {
    render();

    expect(textOf('.health-status')).toContain('Available');
    expect(textOf('.health-latency')).toContain('API response time: 12 ms');
  });

  it('healthCard_probeDown_showsDownLabel', () => {
    health.probe = { up: false, latencyMs: 5000 };
    render();

    expect(textOf('.health-status')).toContain('Unavailable');
    expect((fixture.nativeElement as HTMLElement).querySelector('.health-dot-up')).toBeNull();
  });

  it('kpiCards_loadFailed_renderEmDashInsteadOfNumbers', () => {
    products.pagedFailure = new Error('Authentication required.');
    render();

    // scoped to the KPI values: a substring search over the whole page also hits icon ligatures
    // and the low-stock list, so it would pass or fail for reasons that are not this behaviour
    expect(kpiValues()).toEqual(['—', '—', '—', '—']);
    expect(kpiValues().join('')).not.toContain('42');
    expect(kpiValues().join('')).not.toContain('85.00');
  });

  it('kpiCards_loadedWithoutError_renderTheirNumbers', () => {
    render();

    // the other direction: the em dash appears only as a stand-in, never over real data
    expect(kpiValues().join('')).not.toContain('—');
    expect(kpiValues()[0]).toBe('42');
    expect(kpiValues()[2]).toBe('3');
  });

  it('profitCard_tableView_rendersSameSlicesAsChart', () => {
    reports.profitPayload = MANY_PROFIT;
    render();
    expect(host().querySelector('.slice-table')).toBeNull();

    showProfitTable();

    // ten products plus the aggregated remainder, the exact slices the chart plots
    const rows = host().querySelectorAll('.slice-row');
    expect(rows.length).toBe(11);
    expect(host().querySelector('.slice-table')?.textContent).toContain('Other');
  });

  it('profitCard_tableView_replacesTheChart', () => {
    render();

    showProfitTable();

    // the two halves never share the card's height, as on the reports page
    expect(host().querySelector('.chart-profit app-chart')).toBeNull();
  });

  it('load_always_skipsTheLossReport', () => {
    render();

    // the gross-profit KPI comes from rows the chart already needed, so this request is gone
    expect(reports.lossRequests).toBe(0);
  });

  it('chartHeight_handsetViewport_usesTallerCharts', () => {
    breakpoints.setMatches(false);
    render();

    // Below desktop the rows stack, so the charts trade viewport fit for readability.
    expect(chartHeights()).toEqual(['20rem', '20rem']);
  });

  /** The height each rendered chart was handed, in template order. */
  function chartHeights(): string[] {
    return fixture.debugElement
      .queryAll(By.directive(ChartStubComponent))
      .map((chart) => (chart.componentInstance as ChartStubComponent).height());
  }

  /** The four KPI values in template order: products, low stock, overdue, loss value. */
  function kpiValues(): string[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.kpi-card .kpi-value')
    ).map((element) => (element.textContent ?? '').trim());
  }
});
