import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';

import {
  DueDateBucket,
  InvoiceDueSummary,
  LossReport,
  ProductProfitReport,
  StockStatusReport,
  SupplierProfitReport
} from '../../../core/api/api-models';
import { ChartComponent, ChartOption } from '../../../shared/chart/chart.component';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { ProfitDetailDialogComponent } from '../profit-detail-dialog/profit-detail-dialog.component';
import { ReportService } from '../report.service';
import { ReportsPageComponent } from './reports-page.component';

const TRANSLATIONS = {
  en: {
    invoices: { type: { PURCHASE: 'Purchase', SALE: 'Sale' } },
    reports: {
      title: 'Reports',
      refresh: 'Refresh',
      loading: 'Loading report…',
      deletedHint: 'deleted',
      tabs: { profit: 'Profit', stock: 'Stock', losses: 'Losses', dueDates: 'Due dates' },
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
  { productId: 3, name: 'Widget', sku: 'SKU-3', soldUnits: 4, soldRevenue: 60, inStockUnits: 6, inStockValue: 30 }
];

const LOSSES: LossReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, lostUnits: 2, destroyedUnits: 1, lossValue: 15 }
];

const BUCKETS: DueDateBucket[] = [
  { dueDate: '2026-03-01', invoiceType: 'SALE', invoiceCount: 2, totalValue: 60 }
];

const DUE_SOON: InvoiceDueSummary[] = [
  {
    invoiceId: 9,
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

class ReportServiceStub {
  profitPayload: ProductProfitReport[] = PROFIT;
  lossPayload: LossReport[] = LOSSES;
  calls: string[] = [];
  detail: ProductProfitReport = PROFIT[0];

  profitProducts(): Observable<ProductProfitReport[]> {
    this.calls.push('profitProducts');
    return of(this.profitPayload);
  }

  profitSuppliers(): Observable<SupplierProfitReport[]> {
    this.calls.push('profitSuppliers');
    return of(SUPPLIERS);
  }

  profitProductDetail(id: number): Observable<ProductProfitReport> {
    this.calls.push(`profitProductDetail:${id}`);
    return of(this.detail);
  }

  stockStatus(): Observable<StockStatusReport[]> {
    this.calls.push('stockStatus');
    return of(STOCK);
  }

  losses(): Observable<LossReport[]> {
    this.calls.push('losses');
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
  let dialog: { open: ReturnType<typeof vi.fn> };

  function render(): void {
    fixture = TestBed.createComponent(ReportsPageComponent);
    fixture.detectChanges();
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
    TestBed.resetTestingModule();
    reports = new ReportServiceStub();
    dialog = { open: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        // MatTabBody only attaches a tab body once its transition reports done, and jsdom fires
        // no transition events. Material's own token disables them without pulling in
        // @angular/animations, which this project does not depend on.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        provideRouter([]),
        provideTestTranslations(TRANSLATIONS),
        { provide: ReportService, useValue: reports },
        { provide: MatDialog, useValue: dialog }
      ]
    });
    TestBed.overrideComponent(ReportsPageComponent, {
      remove: { imports: [ChartComponent] },
      add: { imports: [ChartStubComponent] }
    });
  });

  it('ngOnInit_firstRender_loadsOnlyTheProfitTab', () => {
    render();

    // The page must not fire all seven report queries on open.
    expect(reports.calls).toEqual(['profitProducts', 'profitSuppliers']);
  });

  it('activate_stockTab_loadsStockOnFirstActivationOnly', async () => {
    render();
    await activateTab(1);
    expect(reports.calls).toContain('stockStatus');

    await activateTab(0);
    await activateTab(1);

    expect(reports.calls.filter((call) => call === 'stockStatus').length).toBe(1);
  });

  it('activate_dueTab_loadsAllThreeDueQueries', async () => {
    render();
    await activateTab(3);

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

  it('profitTable_deletedProduct_rendersDeletedHint', () => {
    render();

    const hints = (fixture.nativeElement as HTMLElement).querySelectorAll('.deleted-hint');
    expect(hints.length).toBe(1);
    expect(hints[0].textContent).toContain('deleted');
  });

  it('rowClick_profitRow_opensDialogWithFetchedDetail', () => {
    render();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.profit-row')?.click();

    expect(reports.calls).toContain('profitProductDetail:3');
    expect(dialog.open).toHaveBeenCalledWith(ProfitDetailDialogComponent, { data: PROFIT[0] });
  });

  it('dueLists_overdueRows_renderDaysOverdueAndDueSoonRowsDoNot', async () => {
    render();
    await activateTab(3);

    expect((fixture.nativeElement as HTMLElement).querySelector('.overdue-row')?.textContent)
      .toContain('5 days late');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.due-soon-row .days-overdue')
    ).toBeNull();
  });

  it('dueLists_anyRow_linksToItsInvoice', async () => {
    render();
    await activateTab(3);

    const link = (fixture.nativeElement as HTMLElement).querySelector('.overdue-row a');
    expect(link?.getAttribute('href')).toBe('/app/invoices/1');
  });

  it('refresh_onStockTab_refetchesOnlyThatTab', async () => {
    render();
    await activateTab(1);
    reports.calls = [];

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.reports-refresh')
      ?.click();
    fixture.detectChanges();

    expect(reports.calls).toEqual(['stockStatus']);
  });

  it('lossPie_lossesRecorded_buildsPieOption', async () => {
    render();
    await activateTab(2);

    expect(optionOf('lossOption')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.losses-empty')).toBeNull();
  });

  it('lossPie_allLossValuesZero_rendersEmptyStateInsteadOfEmptyPie', async () => {
    reports.lossPayload = [{ ...LOSSES[0], lostUnits: 0, destroyedUnits: 0, lossValue: 0 }];
    render();
    await activateTab(2);

    // A pie of zero-valued slices draws no arcs, so the empty state is the honest rendering.
    expect(optionOf('lossOption')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.losses-empty')).not.toBeNull();
  });

  /** Reads a chart option straight off the component; the stub renders nothing to assert on. */
  function optionOf(name: string): SeriesProbe | null {
    const page = fixture.componentInstance as unknown as Record<string, () => SeriesProbe | null>;
    return page[name]();
  }
});

interface SeriesProbe {
  series?: { data?: { value?: number }[] }[];
}
