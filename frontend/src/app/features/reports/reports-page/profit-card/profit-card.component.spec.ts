import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Sort } from '@angular/material/sort';

import { ProductProfitReport, SupplierProfitReport } from '../../../../core/api/api-models';
import { LanguageService } from '../../../../core/i18n/language.service';
import { provideFakeChartEngine } from '../../../../testing/chart-testing';
import { provideTestTranslations } from '../../../../testing/i18n-testing';
import { ProfitCardComponent } from './profit-card.component';

const TRANSLATIONS = {
  en: {
    reports: {
      exportCsv: 'Export CSV',
      deletedHint: 'deleted',
      columns: { name: 'Name', sku: 'SKU', revenue: 'Revenue', cost: 'Cost', grossProfit: 'Gross profit' },
      profit: {
        margin: 'Overall profit margin',
        byProduct: 'Profit by product',
        products: 'Profit per product',
        suppliers: 'Profit per supplier',
        empty: 'No profit has been recorded yet.',
        suppliersEmpty: 'No supplier has supplied a product yet.'
      }
    }
  }
};

const PROFIT_COLUMNS = ['name', 'sku', 'revenue', 'cost', 'grossProfit'];
const SUPPLIER_COLUMNS = ['name', 'revenue', 'cost', 'grossProfit'];

const PROFIT_ROWS: ProductProfitReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, revenue: 200, cost: 150, grossProfit: 50 },
  { productId: 4, name: 'Gadget', sku: 'SKU-4', deleted: true, revenue: 200, cost: 150, grossProfit: 50 }
];

const SUPPLIER_ROWS: SupplierProfitReport[] = [
  { supplierId: 7, name: 'Acme', revenue: 400, cost: 300, grossProfit: 100 }
];

/*
 * The profit tab's body below the two toggles, as a card: the margin gauge beside the by-product
 * chart, the per-product and per-supplier tables behind them, and the five controls it announces
 * rather than acts on - two sorts, two exports, and the row the reader asked to drill into.
 * Out of scope: where the options and the rows come from, what a sort does to the page's own row
 * order, what the exports write, and what opening a row fetches - all of which stay with the page
 * and are covered by reports-page.profit.spec.ts; and the chart wrapper (chart.component.spec.ts).
 * Siblings: changes-card.component.spec.ts, losses-card.component.spec.ts,
 * stock-card.component.spec.ts, due-dates-card.component.spec.ts, period-toggle.component.spec.ts,
 * report-view-toggle.component.spec.ts and supplier-product-picker.component.spec.ts are the
 * reports page's other extracted pieces.
 */
describe('ProfitCardComponent', () => {
  let fixture: ComponentFixture<ProfitCardComponent>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /* Renders the card in one of its halves; every input the template reads is set here. */
  async function render(overrides: Record<string, unknown> = {}): Promise<void> {
    const inputs: Record<string, unknown> = {
      view: 'table', marginOption: { series: [] }, profitOption: { series: [] },
      profitRows: PROFIT_ROWS, supplierRows: SUPPLIER_ROWS,
      profitColumns: PROFIT_COLUMNS, supplierColumns: SUPPLIER_COLUMNS, ...overrides
    };
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await settle();
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [ProfitCardComponent],
      providers: [provideTestTranslations(TRANSLATIONS), provideFakeChartEngine()]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(ProfitCardComponent);
  });

  it('chartHalf_bothOptionsGiven_drawsBothCharts', async () => {
    await render({ view: 'chart' });

    expect(host().querySelectorAll('app-chart').length).toBe(2);
    expect(host().querySelector('.margin-empty')).toBeNull();
  });

  it('chartHalf_onlyTheMarginMissing_showsItsEmptyStateAndKeepsTheOtherChart', async () => {
    await render({ view: 'chart', marginOption: null });

    // The two cards answer independently: no revenue to divide by is not the same news as no rows.
    expect(host().querySelector('.margin-empty')).not.toBeNull();
    expect(host().querySelectorAll('app-chart').length).toBe(1);
  });

  it('chartHalf_onlyTheProductChartMissing_showsItsEmptyStateAndKeepsTheGauge', async () => {
    await render({ view: 'chart', profitOption: null });

    expect(host().querySelector('.margin-empty')).toBeNull();
    expect(host().querySelectorAll('app-chart').length).toBe(1);
  });

  it('tableHalf_rowsGiven_rendersBothTables', async () => {
    await render();

    expect(host().querySelectorAll('.profit-table tbody tr').length).toBe(2);
    expect(host().querySelectorAll('.supplier-table tbody tr').length).toBe(1);
  });

  it('tableHalf_noProfitRows_showsItsEmptyStateAndKeepsTheSupplierTable', async () => {
    await render({ profitRows: [] });

    // Each table gates on its own array; there is no shared hasRows on this tab.
    expect(host().querySelector('.profit-table')).toBeNull();
    expect(host().querySelector('.export-profit')).toBeNull();
    expect(host().querySelectorAll('.supplier-table tbody tr').length).toBe(1);
  });

  it('tableHalf_noSupplierRows_showsItsEmptyStateAndKeepsTheProfitTable', async () => {
    await render({ supplierRows: [] });

    expect(host().querySelector('.supplier-table')).toBeNull();
    expect(host().querySelector('.export-suppliers')).toBeNull();
    expect(host().textContent).toContain('No supplier has supplied a product yet.');
  });

  it('profitTable_deletedProduct_marksTheRow', async () => {
    await render();

    const hints = host().querySelectorAll('.profit-table .deleted-hint');
    expect(hints.length).toBe(1);
    expect(hints[0].textContent?.trim()).toBe('deleted');
  });

  it('profitSortHeader_clicked_emitsTheSortWithoutReorderingHere', async () => {
    await render();
    const emitted: Sort[] = [];
    fixture.componentInstance.profitSortChange.subscribe((value) => emitted.push(value));

    host().querySelectorAll<HTMLElement>('.profit-table th.mat-sort-header')[0].click();
    await settle();

    expect(emitted.at(-1)).toEqual({ active: 'name', direction: 'asc' });
    expect(host().querySelector('.profit-table tbody tr td')?.textContent?.trim()).toBe('Widget');
  });

  it('supplierSortHeader_clicked_emitsTheSortWithoutReorderingHere', async () => {
    await render();
    const emitted: Sort[] = [];
    fixture.componentInstance.supplierSortChange.subscribe((value) => emitted.push(value));

    host().querySelectorAll<HTMLElement>('.supplier-table th.mat-sort-header')[0].click();
    await settle();

    expect(emitted.at(-1)).toEqual({ active: 'name', direction: 'asc' });
  });

  it('exportButtons_clicked_eachEmitsItsOwnRequest', async () => {
    await render();
    let products = 0;
    let suppliers = 0;
    fixture.componentInstance.exportProfitRequested.subscribe(() => products++);
    fixture.componentInstance.exportSuppliersRequested.subscribe(() => suppliers++);

    host().querySelector<HTMLButtonElement>('.export-profit')?.click();
    await settle();

    // Two tables, two downloads: the card has neither CSV service and asks for one at a time.
    expect([products, suppliers]).toEqual([1, 0]);
  });

  it('exportSuppliersButton_clicked_emitsTheSuppliersRequest', async () => {
    await render();
    let suppliers = 0;
    fixture.componentInstance.exportSuppliersRequested.subscribe(() => suppliers++);

    host().querySelector<HTMLButtonElement>('.export-suppliers')?.click();
    await settle();

    expect(suppliers).toBe(1);
  });

  it('profitRow_clicked_raisesTheRowForTheDrillDown', async () => {
    await render();
    const opened: ProductProfitReport[] = [];
    fixture.componentInstance.rowActivated.subscribe((row) => opened.push(row));

    host().querySelector<HTMLElement>('.profit-row')?.click();
    await settle();

    // The row itself, not its id: the page fetches the detail and needs the product it names.
    expect(opened).toEqual([PROFIT_ROWS[0]]);
  });

  it('profitRow_enterPressed_raisesTheRowAsAClickDoes', async () => {
    await render();
    const opened: ProductProfitReport[] = [];
    fixture.componentInstance.rowActivated.subscribe((row) => opened.push(row));

    host().querySelector<HTMLElement>('.profit-row')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();

    // The rows are focusable, so the keyboard has to reach the same drill-down the mouse does.
    expect(opened).toEqual([PROFIT_ROWS[0]]);
  });
});
