import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Sort } from '@angular/material/sort';

import { LossByRemark, LossReport } from '../../../../core/api/api-models';
import { LanguageService } from '../../../../core/i18n/language.service';
import { provideFakeChartEngine } from '../../../../testing/chart-testing';
import { provideTestTranslations } from '../../../../testing/i18n-testing';
import { LossesCardComponent } from './losses-card.component';

const TRANSLATIONS = {
  en: {
    reports: {
      filter: 'Filter',
      exportCsv: 'Export CSV',
      deletedHint: 'deleted',
      view: { chart: 'Chart', table: 'Table', list: 'List' },
      losses: { byProduct: 'Loss share by product', byRemark: 'Losses by cause', empty: 'No losses have been recorded.' },
      columns: {
        name: 'Name', sku: 'SKU', lostUnits: 'Lost', destroyedUnits: 'Destroyed',
        lossValue: 'Loss value', remark: 'Cause'
      }
    },
    movements: { form: { remarkOption: { EXPIRED: 'Expired', IN_TRANSIT_TO_CUSTOMER: 'In transit to customer' } } }
  }
};

const COLUMNS = ['name', 'sku', 'lostUnits', 'destroyedUnits', 'lossValue'];

const ROWS: LossReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, lostUnits: 2, destroyedUnits: 1, lossValue: 15 },
  { productId: 4, name: 'Gadget', sku: 'ABC-4', deleted: false, lostUnits: 3, destroyedUnits: 4, lossValue: 25 }
];

const REMARKS: LossByRemark[] = [
  { remark: 'EXPIRED', lostUnits: 1, destroyedUnits: 2, lossValue: 12 },
  { remark: 'IN_TRANSIT_TO_CUSTOMER', lostUnits: 3, destroyedUnits: 0, lossValue: 30 }
];

const TOTALS = { value: 40, lost: 5, destroyed: 5 };

/*
 * The losses tab's body below the period toggle, as a card: the totals strip beside the view
 * toggle, the loss-share chart or the per-product table behind it, the by-cause breakdown that
 * shows in both view modes, and the four controls it announces rather than acts on.
 * Out of scope: where the totals, the option and the rows come from, whether a filter narrows what
 * the export writes, what a sort does to the underlying rows, and the period preset above this card
 * - all of which stay with the page and are covered by reports-page.losses.spec.ts; and the chart
 * wrapper (chart.component.spec.ts).
 * Siblings: stock-card.component.spec.ts, due-dates-card.component.spec.ts,
 * period-toggle.component.spec.ts, report-view-toggle.component.spec.ts and
 * supplier-product-picker.component.spec.ts are the reports page's other extracted pieces.
 */
describe('LossesCardComponent', () => {
  let fixture: ComponentFixture<LossesCardComponent>;

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
      rows: ROWS, hasRows: true, columns: COLUMNS, remarkRows: REMARKS, ...overrides
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
      imports: [LossesCardComponent],
      providers: [provideTestTranslations(TRANSLATIONS), provideFakeChartEngine()]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(LossesCardComponent);
  });

  it('totalsStrip_totalsGiven_statesAllThreeFigures', async () => {
    await render();

    expect(host().querySelector('.loss-total-value')?.textContent).toContain('40');
    expect(host().querySelector('.loss-total-lost')?.textContent?.trim()).toBe('5');
    expect(host().querySelector('.loss-total-destroyed')?.textContent?.trim()).toBe('5');
  });

  it('totalsStrip_nullTotals_rendersNoStripAtAll', async () => {
    await render({ totals: null });

    expect(host().querySelector('.totals-strip')).toBeNull();
  });

  it('chartHalf_optionGiven_drawsTheChartRatherThanTheEmptyState', async () => {
    await render({ view: 'chart' });

    expect(host().querySelector('app-chart')).not.toBeNull();
    expect(host().querySelector('.losses-empty')).toBeNull();
  });

  it('chartHalf_nullOption_showsTheEmptyStateInsteadOfAnEmptyPie', async () => {
    await render({ view: 'chart', option: null });

    // A pie of zero-valued slices draws no arcs, so the empty state is the honest rendering.
    expect(host().querySelector('app-chart')).toBeNull();
    expect(host().querySelector('.losses-empty')).not.toBeNull();
  });

  it('tableHalf_rowsGiven_rendersOneRowPerEntry', async () => {
    await render();

    expect(host().querySelectorAll('.loss-table tbody tr').length).toBe(2);
  });

  it('tableHalf_noRowsLoaded_showsEmptyStateWithNoFilterRow', async () => {
    await render({ rows: [], hasRows: false });

    expect(host().querySelector('.report-filter')).toBeNull();
    expect(host().querySelector('.export-losses')).toBeNull();
    expect(host().querySelector('.loss-table')).toBeNull();
  });

  it('tableHalf_filterEmptiedTheRows_keepsTheFilterRowOnScreen', async () => {
    await render({ rows: [], hasRows: true });

    // hasRows asks whether the tab loaded anything, not whether the filter matched.
    expect(host().querySelector('.report-filter')).not.toBeNull();
    expect(host().querySelectorAll('.loss-table tbody tr').length).toBe(0);
  });

  it('lossTable_deletedProduct_marksTheRow', async () => {
    await render({ rows: [{ ...ROWS[0], deleted: true }] });

    // A row for a product that no longer exists has to say so, or the number looks unexplained.
    expect(host().querySelector('.loss-table .deleted-hint')?.textContent?.trim()).toBe('deleted');
  });

  it('remarkTable_tableView_rendersTranslatedCauses', async () => {
    await render();

    const causes = Array.from(host().querySelectorAll('.loss-remark-table tbody tr td:first-child'));
    expect(causes.map((cell) => cell.textContent?.trim())).toEqual(['Expired', 'In transit to customer']);
  });

  it('remarkTable_chartView_isStillRendered', async () => {
    await render({ view: 'chart' });

    // The breakdown sits outside the toggle: it shows in both of the tab's modes.
    expect(host().querySelectorAll('.loss-remark-table tbody tr').length).toBe(2);
  });

  it('remarkTable_noRemarkRows_showsItsOwnEmptyState', async () => {
    await render({ remarkRows: [] });

    expect(host().querySelector('.loss-remark-table')).toBeNull();
    expect(host().querySelector('.losses-remark-empty')).not.toBeNull();
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

    expect(emitted).toEqual(['Gadget']);
    expect(host().querySelectorAll('.loss-table tbody tr').length).toBe(2);
  });

  it('sortHeader_clicked_emitsTheSortWithoutReorderingHere', async () => {
    await render();
    const emitted: Sort[] = [];
    fixture.componentInstance.sortChange.subscribe((value) => emitted.push(value));

    host().querySelectorAll<HTMLElement>('.loss-table th.mat-sort-header')[0].click();
    await settle();

    expect(emitted.at(-1)).toEqual({ active: 'name', direction: 'asc' });
    expect(host().querySelector('.loss-table tbody tr td')?.textContent?.trim()).toBe('Widget');
  });

  it('exportButton_clicked_emitsTheRequest', async () => {
    await render();
    let asked = 0;
    fixture.componentInstance.exportRequested.subscribe(() => asked++);

    host().querySelector<HTMLButtonElement>('.export-losses')?.click();
    await settle();

    // The card has no CSV service and no downloader; asking is all it can do.
    expect(asked).toBe(1);
  });
});
