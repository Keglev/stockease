import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LanguageService } from '../../../core/i18n/language.service';
import {
  LOSSES,
  ReportServiceStub,
  configureReportsPageTestBed,
  createReportsPageHelpers
} from './reports-page.fixtures';
import { LossTabState } from './loss-tab-state';
import { ReportsPageComponent } from './reports-page.component';

/*
 * The losses tab: the totals strip, the loss-share pie, the per-product table behind the view
 * toggle with its filter, sorting and export, the period presets, and the by-cause breakdown that
 * sits outside the toggle and reads its labels from the movement form's own translation subtree.
 *
 * That the tab's two queries share one window is pinned here; that they share one error banner is
 * a page-level contract and belongs to the shell spec.
 *
 * Siblings: reports-page.component.spec.ts (shell), and the tab siblings reports-page.profit.spec.ts,
 * reports-page.cash-flow.spec.ts, reports-page.stock.spec.ts, reports-page.due-dates.spec.ts,
 * reports-page.changes.spec.ts, and reports-page.analytics.spec.ts.
 * Out of scope: the requests (report.service.spec.ts), the chart wrapper
 * (chart.component.spec.ts), the top-N rule (chart-data.spec.ts) and the profit drill-down
 * (profit-detail-dialog.component.spec.ts).
 */
describe('ReportsPageComponent losses tab', () => {
  let fixture: ComponentFixture<ReportsPageComponent>;
  let reports: ReportServiceStub;
  let download: ReturnType<typeof vi.fn>;

  const { render, host, textOf, activateTab, showTable, optionOf, setFilter, typeFilter, sortBy, columnText } =
    createReportsPageHelpers(() => fixture, (value) => { fixture = value; });

  beforeEach(() => {
    // Only Date is faked: the period presets compute their bounds from today, and a test reading
    // the real clock would change its expected range every day. Timers stay real.
    vi.useFakeTimers({ toFake: ['Date'] });
    download = vi.fn();
    ({ reports } = configureReportsPageTestBed({ open: vi.fn() }, download));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lossPie_lossesRecorded_buildsPieOption', async () => {
    render();
    await activateTab(3);

    expect(optionOf('lossOption')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.losses-empty')).toBeNull();
  });

  it('lossPie_allLossValuesZero_rendersEmptyStateInsteadOfEmptyPie', async () => {
    reports.lossPayload = [{ ...LOSSES[0], lostUnits: 0, destroyedUnits: 0, lossValue: 0 }];
    render();
    await activateTab(3);

    // A pie of zero-valued slices draws no arcs, so the empty state is the honest rendering.
    expect(optionOf('lossOption')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.losses-empty')).not.toBeNull();
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

  it('sortLosses_nameHeaderClicked_ordersRows', async () => {
    render();
    await activateTab(3);
    await showTable(3);

    await sortBy('.loss-table', 0);

    const names = columnText('.loss-table', 0);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
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

  /*
   * Clicks a loss period preset the way the toggle group does. The handler moved to the tab's own
   * collaborator (ADR 039), which is where the toggle's binding now reaches too, so this drives
   * the same code the template drives.
   */
  async function selectLossPeriod(period: string): Promise<void> {
    const losses = fixture.debugElement.injector.get(LossTabState) as unknown as {
      setPeriod: (value: string) => void;
    };
    losses.setPeriod(period);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /* Cells of the by-cause table, row by row, in column order. */
  function remarkRows(): string[][] {
    return Array.from(host().querySelectorAll('.loss-remark-table tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() ?? '')
    );
  }
});
