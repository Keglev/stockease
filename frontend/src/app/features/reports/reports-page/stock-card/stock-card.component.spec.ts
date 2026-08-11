import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Sort } from '@angular/material/sort';

import { StockStatusReport } from '../../../../core/api/api-models';
import { LanguageService } from '../../../../core/i18n/language.service';
import { provideFakeChartEngine } from '../../../../testing/chart-testing';
import { provideTestTranslations } from '../../../../testing/i18n-testing';
import { StockCardComponent } from './stock-card.component';

const TRANSLATIONS = {
  en: {
    reports: {
      filter: 'Filter',
      exportCsv: 'Export CSV',
      view: { chart: 'Chart', table: 'Table', list: 'List' },
      stock: { byValue: 'Products by stock value', empty: 'No products are currently in stock.', productCount: 'Products' },
      columns: {
        name: 'Name', sku: 'SKU', soldUnits: 'Sold units', soldRevenue: 'Sales revenue',
        inStockUnits: 'Units in stock', inStockValue: 'Stock value'
      }
    }
  }
};

const COLUMNS = ['name', 'sku', 'soldUnits', 'soldRevenue', 'inStockUnits', 'inStockValue'];

const ROWS: StockStatusReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', soldUnits: 4, soldRevenue: 60, inStockUnits: 6, inStockValue: 30 },
  { productId: 4, name: 'Gadget', sku: 'ABC-4', soldUnits: 1, soldRevenue: 10, inStockUnits: 4, inStockValue: 20 }
];

const TOTALS = { value: 50, units: 10, products: 2 };

/*
 * The stock tab's body, as a card: the totals strip beside the view toggle on one line, the
 * stock-value chart or the table behind it, and the four controls it announces rather than acts on
 * - the view switch, the filter term, the sort and the export.
 * Out of scope: where the totals, the option and the rows come from, whether a filter narrows what
 * the export writes, and what a sort does to the underlying rows - all of which stay with the page
 * and are covered by reports-page.stock.spec.ts; and the chart wrapper (chart.component.spec.ts).
 * Siblings: due-dates-card.component.spec.ts, period-toggle.component.spec.ts,
 * report-view-toggle.component.spec.ts and supplier-product-picker.component.spec.ts are the
 * reports page's other extracted pieces.
 */
describe('StockCardComponent', () => {
  let fixture: ComponentFixture<StockCardComponent>;

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
      view: 'table', option: { series: [] }, totals: TOTALS, filter: '',
      rows: ROWS, hasRows: true, columns: COLUMNS, ...overrides
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
      imports: [StockCardComponent],
      providers: [provideTestTranslations(TRANSLATIONS), provideFakeChartEngine()]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(StockCardComponent);
  });

  it('totalsStrip_totalsGiven_statesAllThreeFigures', async () => {
    await render();

    expect(host().querySelector('.stock-total-value')?.textContent).toContain('50');
    expect(host().querySelector('.stock-total-units')?.textContent?.trim()).toBe('10');
    expect(host().querySelector('.stock-total-products')?.textContent?.trim()).toBe('2');
  });

  it('totalsStrip_nullTotals_rendersNoStripAtAll', async () => {
    await render({ totals: null });

    // Nothing loaded means the strip has nothing to state, and an empty row of labels would be
    // worse than no row.
    expect(host().querySelector('.totals-strip')).toBeNull();
  });

  it('chartHalf_optionGiven_drawsTheChartRatherThanTheEmptyState', async () => {
    await render({ view: 'chart' });

    expect(host().querySelector('app-chart')).not.toBeNull();
    expect(host().querySelector('.empty-state')).toBeNull();
  });

  it('chartHalf_nullOption_showsTheEmptyStateInsteadOfAnEmptyChart', async () => {
    await render({ view: 'chart', option: null });

    expect(host().querySelector('app-chart')).toBeNull();
    expect(host().textContent).toContain('No products are currently in stock.');
  });

  it('tableHalf_rowsGiven_rendersOneRowPerEntry', async () => {
    await render();

    expect(host().querySelectorAll('.stock-table tbody tr').length).toBe(2);
  });

  it('tableHalf_noRowsLoaded_showsEmptyStateWithNoFilterRow', async () => {
    await render({ rows: [], hasRows: false });

    // The heading carries the filter and the export, and neither has anything to act on yet.
    expect(host().querySelector('.report-filter')).toBeNull();
    expect(host().querySelector('.export-stock')).toBeNull();
    expect(host().textContent).toContain('No products are currently in stock.');
  });

  it('tableHalf_filterEmptiedTheRows_keepsTheFilterRowOnScreen', async () => {
    await render({ rows: [], hasRows: true });

    // hasRows asks whether the tab loaded anything, not whether the filter matched: hiding the box
    // because it narrowed to nothing would leave no way to undo it.
    expect(host().querySelector('.report-filter')).not.toBeNull();
    expect(host().querySelectorAll('.stock-table tbody tr').length).toBe(0);
  });

  it('viewToggle_clicked_emitsTheViewWithoutChangingTheInput', async () => {
    await render();
    const emitted: string[] = [];
    fixture.componentInstance.viewChange.subscribe((value) => emitted.push(value));

    host().querySelectorAll<HTMLButtonElement>('mat-button-toggle button')[0].click();
    await settle();

    expect(emitted.at(-1)).toBe('chart');
    expect(fixture.componentInstance.view()).toBe('table');
  });

  it('filterField_typedInto_emitsTheTermWithoutFilteringHere', async () => {
    await render();
    const emitted: string[] = [];
    fixture.componentInstance.filterChange.subscribe((value) => emitted.push(value));

    const input = host().querySelector<HTMLInputElement>('.report-filter input');
    input!.value = 'Gadget';
    input!.dispatchEvent(new Event('input'));
    await settle();

    // The card announces the term; the rows it draws stay the ones it was handed.
    expect(emitted).toEqual(['Gadget']);
    expect(host().querySelectorAll('.stock-table tbody tr').length).toBe(2);
  });

  it('sortHeader_clicked_emitsTheSortWithoutReorderingHere', async () => {
    await render();
    const emitted: Sort[] = [];
    fixture.componentInstance.sortChange.subscribe((value) => emitted.push(value));

    host().querySelectorAll<HTMLElement>('.stock-table th.mat-sort-header')[0].click();
    await settle();

    expect(emitted.at(-1)).toEqual({ active: 'name', direction: 'asc' });
    expect(host().querySelector('.stock-table tbody tr td')?.textContent?.trim()).toBe('Widget');
  });

  it('exportButton_clicked_emitsTheRequest', async () => {
    await render();
    let asked = 0;
    fixture.componentInstance.exportRequested.subscribe(() => asked++);

    host().querySelector<HTMLButtonElement>('.export-stock')?.click();
    await settle();

    // The card has no CSV service and no downloader; asking is all it can do.
    expect(asked).toBe(1);
  });
});
