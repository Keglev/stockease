import { ComponentFixture } from '@angular/core/testing';

import { ProductProfitReport } from '../../../core/api/api-models';
import { ProfitDetailDialogComponent } from '../profit-detail-dialog/profit-detail-dialog.component';
import {
  PROFIT,
  ReportServiceStub,
  configureReportsPageTestBed,
  createReportsPageHelpers
} from './reports-page.fixtures';
import { ReportsPageComponent } from './reports-page.component';

/*
 * The profit tab: the margin gauge and the profit-by-product chart, the per-product and
 * per-supplier tables behind the view toggle, their sorting and their CSV exports, the period
 * presets both profit queries answer together, and the row drill-down that fetches a product's
 * detail before opening the dialog over it.
 *
 * The page-level contracts this tab is loaded by - that opening the page loads this tab and only
 * this tab, and that its failures reach the shared banner - belong to the shell spec.
 *
 * Siblings: reports-page.component.spec.ts (shell), and the tab siblings reports-page.cash-flow.spec.ts,
 * reports-page.stock.spec.ts, reports-page.losses.spec.ts, reports-page.due-dates.spec.ts,
 * reports-page.changes.spec.ts, and reports-page.analytics.spec.ts.
 * Out of scope: the requests (report.service.spec.ts), the chart wrapper
 * (chart.component.spec.ts), the top-N rule (chart-data.spec.ts) and the profit drill-down
 * (profit-detail-dialog.component.spec.ts).
 */
/*
 * Three rows whose server order matches neither the ascending nor the descending name order, so a
 * sort pin can tell all three apart. Two rows could not: with two, descending IS the server order
 * whenever the server happened to send them descending, and the return-to-server-order case then
 * asserts nothing.
 */
const SORT_ROWS: ProductProfitReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, revenue: 9, cost: 3, grossProfit: 8 },
  { productId: 5, name: 'Anvil', sku: 'SKU-5', deleted: false, revenue: 100, cost: 1, grossProfit: 99 },
  { productId: 4, name: 'Gadget', sku: 'SKU-4', deleted: false, revenue: 50, cost: 2, grossProfit: 20 }
];

describe('ReportsPageComponent profit tab', () => {
  let fixture: ComponentFixture<ReportsPageComponent>;
  let reports: ReportServiceStub;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let download: ReturnType<typeof vi.fn>;

  const { render, host, settle, showTable, optionOf, sortBy, columnText } =
    createReportsPageHelpers(() => fixture, (value) => { fixture = value; });

  beforeEach(() => {
    // Only Date is faked: the period presets compute their bounds from today, and a test reading
    // the real clock would change its expected range every day. Timers stay real.
    vi.useFakeTimers({ toFake: ['Date'] });
    dialog = { open: vi.fn() };
    download = vi.fn();
    ({ reports } = configureReportsPageTestBed(dialog, download));
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('sortProfit_nameHeaderClicked_ordersRowsAlphabeticallyThenReverses', async () => {
    reports.profitPayload = SORT_ROWS;
    render();
    await showTable(0);

    await sortBy('.profit-table', 0);
    expect(columnText('.profit-table', 0)).toEqual(['Anvil', 'Gadget', 'Widget']);

    await sortBy('.profit-table', 0);
    expect(columnText('.profit-table', 0)).toEqual(['Widget', 'Gadget', 'Anvil']);
  });

  it('sortProfit_numericColumn_ordersByValueRatherThanByText', async () => {
    reports.profitPayload = SORT_ROWS;
    render();
    await showTable(0);

    // Sorted as text, 100 would come before 50 and 9 last - which is the whole reason the
    // comparator checks the operand types rather than stringifying everything.
    await sortBy('.profit-table', 1);
    expect(columnText('.profit-table', 0)).toEqual(['Widget', 'Gadget', 'Anvil']);
  });

  it('sortProfit_clickedPastDescending_returnsToTheServerOrder', async () => {
    reports.profitPayload = SORT_ROWS;
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

  it('profitTab_noSupplierRows_showsEmptyStateAndOffersNoExport', async () => {
    reports.supplierPayload = [];
    render();
    await showTable(0);

    expect(host().querySelector('.export-suppliers')).toBeNull();
    expect(host().textContent).toContain('No supplier has supplied a product yet.');
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

  it('period_year_computesTheCalendarYearToDateRange', async () => {
    vi.setSystemTime(new Date(2026, 5, 15, 12));
    render();

    await selectProfitPeriod('year');

    // From 1 January of the current year, not 365 days back: "this year" is a calendar claim.
    expect(reports.profitRanges['products'].at(-1)).toEqual(['2026-01-01', '2026-06-15']);
  });

  it('exportSuppliers_clicked_downloadsTheSupplierTable', async () => {
    render();
    await showTable(0);

    host().querySelector<HTMLButtonElement>('.export-suppliers')?.click();

    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][0]).toBe('profit-suppliers.csv');
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
});
