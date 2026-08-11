import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CashFlowProductRow } from '../../../../core/api/api-models';
import { LanguageService } from '../../../../core/i18n/language.service';
import { provideFakeChartEngine } from '../../../../testing/chart-testing';
import { provideTestTranslations } from '../../../../testing/i18n-testing';
import { CashFlowCardComponent } from './cash-flow-card.component';

const TRANSLATIONS = {
  en: {
    reports: {
      filter: 'Filter',
      exportCsv: 'Export CSV',
      deletedHint: 'deleted',
      view: { chart: 'Chart', table: 'Table', list: 'List' },
      cashFlow: {
        inflow: 'Inflow',
        outflow: 'Outflow',
        net: 'Net',
        empty: 'No paid invoices in this period.',
        columns: { name: 'Product', sku: 'SKU', inflow: 'Inflow', outflow: 'Outflow', net: 'Net' }
      }
    }
  }
};

const COLUMNS = ['name', 'sku', 'inflow', 'outflow', 'net'];

const ROWS: CashFlowProductRow[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, inflow: 500, outflow: 300, net: 200 },
  { productId: 4, name: 'Gadget', sku: 'ABC-4', deleted: true, inflow: 0, outflow: 400, net: -400 }
];

const TOTALS = { inflow: 500, outflow: 300, net: 200 };

/*
 * The cash-flow tab's body below the search row, as a card: the totals strip beside the view
 * toggle, the monthly timeline or the per-product table behind it, and the three controls it
 * announces rather than acts on - the view switch, the filter term and the export.
 * Out of scope: where the totals, the option and the rows come from, when the per-product query is
 * fetched, what the filter narrows and what the export writes - all of which stay with the page and
 * are covered by reports-page.cash-flow.spec.ts; and the chart wrapper (chart.component.spec.ts).
 * Siblings: analytics-card.component.spec.ts, profit-card.component.spec.ts,
 * changes-card.component.spec.ts, losses-card.component.spec.ts, stock-card.component.spec.ts,
 * due-dates-card.component.spec.ts, period-toggle.component.spec.ts,
 * report-view-toggle.component.spec.ts and supplier-product-picker.component.spec.ts are the
 * reports page's other extracted pieces.
 */
describe('CashFlowCardComponent', () => {
  let fixture: ComponentFixture<CashFlowCardComponent>;

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
      imports: [CashFlowCardComponent],
      providers: [provideTestTranslations(TRANSLATIONS), provideFakeChartEngine()]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(CashFlowCardComponent);
  });

  it('totalsStrip_totalsGiven_statesAllThreeFigures', async () => {
    await render();

    expect(host().querySelector('.cash-flow-inflow')?.textContent).toContain('500');
    expect(host().querySelector('.cash-flow-outflow')?.textContent).toContain('300');
    expect(host().querySelector('.cash-flow-net')?.textContent).toContain('200');
  });

  it('totalsStrip_nullTotals_rendersNoStripAtAll', async () => {
    await render({ totals: null });

    expect(host().querySelector('.totals-strip')).toBeNull();
  });

  it('netTotal_negative_carriesTheErrorColourClass', async () => {
    await render({ totals: { inflow: 100, outflow: 400, net: -300 } });

    // The class, not the computed colour: jsdom resolves no tokens. Money going out net is the one
    // figure worth catching the eye.
    expect(host().querySelector('.cash-flow-net.cash-flow-negative')).not.toBeNull();
  });

  it('netTotal_positive_omitsTheErrorColourClass', async () => {
    await render();

    expect(host().querySelector('.cash-flow-net')).not.toBeNull();
    expect(host().querySelector('.cash-flow-net.cash-flow-negative')).toBeNull();
  });

  it('chartHalf_optionGiven_drawsTheTimelineRatherThanTheEmptyState', async () => {
    await render({ view: 'chart' });

    expect(host().querySelector('app-chart')).not.toBeNull();
    expect(host().querySelector('.cash-flow-empty')).toBeNull();
  });

  it('chartHalf_nullOption_showsTheEmptyStateInsteadOfAnEmptyChart', async () => {
    await render({ view: 'chart', option: null });

    expect(host().querySelector('app-chart')).toBeNull();
    expect(host().querySelector('.cash-flow-empty')).not.toBeNull();
  });

  it('tableHalf_rowsGiven_rendersOneRowPerEntry', async () => {
    await render();

    expect(host().querySelectorAll('.cash-flow-table tbody tr').length).toBe(2);
  });

  it('tableHalf_noRowsFetched_showsEmptyStateWithNoFilterRow', async () => {
    await render({ rows: [], hasRows: false });

    // Both gates read hasRows: the per-product query is lazy, so before the first switch there is
    // nothing to filter and nothing to export.
    expect(host().querySelector('.report-filter')).toBeNull();
    expect(host().querySelector('.export-cash-flow')).toBeNull();
    expect(host().querySelector('.cash-flow-empty')).not.toBeNull();
  });

  it('tableHalf_filterEmptiedTheRows_keepsTheFilterRowOnScreen', async () => {
    await render({ rows: [], hasRows: true });

    // hasRows asks whether the query answered, not whether the filter matched.
    expect(host().querySelector('.report-filter')).not.toBeNull();
    expect(host().querySelectorAll('.cash-flow-table tbody tr').length).toBe(0);
  });

  it('cashFlowTable_deletedProduct_marksTheRow', async () => {
    await render();

    const hints = host().querySelectorAll('.cash-flow-table .deleted-hint');
    expect(hints.length).toBe(1);
    expect(hints[0].textContent?.trim()).toBe('deleted');
  });

  it('viewToggle_clicked_emitsTheViewWithoutChangingTheInput', async () => {
    await render();
    const emitted: string[] = [];
    fixture.componentInstance.viewChange.subscribe((value) => emitted.push(value));

    host().querySelectorAll<HTMLButtonElement>('mat-button-toggle button')[0].click();
    await settle();

    // The page acts on this: the first switch to the table is what fetches the rows.
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
    expect(host().querySelectorAll('.cash-flow-table tbody tr').length).toBe(2);
  });

  it('exportButton_clicked_emitsTheRequest', async () => {
    await render();
    let asked = 0;
    fixture.componentInstance.exportRequested.subscribe(() => asked++);

    host().querySelector<HTMLButtonElement>('.export-cash-flow')?.click();
    await settle();

    // The card has no CSV service and no downloader; asking is all it can do.
    expect(asked).toBe(1);
  });
});
