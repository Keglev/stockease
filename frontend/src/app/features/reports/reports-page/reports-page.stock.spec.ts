import { ComponentFixture } from '@angular/core/testing';

import {
  ReportServiceStub,
  configureReportsPageTestBed,
  createReportsPageHelpers
} from './reports-page.fixtures';
import { ReportsPageComponent } from './reports-page.component';

/*
 * The stock tab: the totals strip summed from the loaded rows, the stock-value chart, and the
 * table behind the view toggle with its name-or-SKU filter, its sorting and its export.
 *
 * That the tab loads once on first activation, and that its failure reaches the shared banner,
 * are page-level contracts and belong to the shell spec.
 *
 * Siblings: reports-page.component.spec.ts (shell), and the tab siblings reports-page.profit.spec.ts,
 * reports-page.cash-flow.spec.ts, reports-page.losses.spec.ts, reports-page.due-dates.spec.ts,
 * reports-page.changes.spec.ts, and reports-page.analytics.spec.ts.
 * Out of scope: the requests (report.service.spec.ts), the chart wrapper
 * (chart.component.spec.ts), the top-N rule (chart-data.spec.ts) and the profit drill-down
 * (profit-detail-dialog.component.spec.ts).
 */
describe('ReportsPageComponent stock tab', () => {
  let fixture: ComponentFixture<ReportsPageComponent>;
  let reports: ReportServiceStub;
  let download: ReturnType<typeof vi.fn>;

  const { render, host, textOf, activateTab, showTable, setFilter, typeFilter, sortBy, columnText } =
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

  it('stockTab_totalsStrip_sumsLoadedRows', async () => {
    render();
    await activateTab(2);

    // 30 + 20, 6 + 4, and two rows: the strip is the table added up, so the two cannot disagree
    expect(textOf('.stock-total-value')).toContain('50');
    expect(textOf('.stock-total-units').trim()).toBe('10');
    expect(textOf('.stock-total-products').trim()).toBe('2');
  });

  it('stockTab_filter_narrowsRowsAndExport', async () => {
    render();
    await activateTab(2);
    await showTable(2);

    await setFilter('setStockFilter', 'abc-4');

    expect(host().querySelectorAll('.stock-table tbody tr').length).toBe(1);
    host().querySelector<HTMLButtonElement>('.export-stock')?.click();

    const [, content] = download.mock.calls[0] as [string, string];
    expect(content).toContain('Gadget');
    expect(content).not.toContain('Widget');
  });

  it('sortStock_nameHeaderClicked_ordersRows', async () => {
    render();
    await activateTab(2);
    await showTable(2);

    await sortBy('.stock-table', 0);

    const names = columnText('.stock-table', 0);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('stockFilter_typedIntoTheField_narrowsTheTable', async () => {
    render();
    await activateTab(2);
    await showTable(2);

    await typeFilter('Gadget');

    expect(host().querySelectorAll('.stock-table tbody tr').length).toBe(1);
  });

  it('stockTab_noRows_showsEmptyStateWithNoFilterRow', async () => {
    reports.stockPayload = [];
    render();
    await activateTab(2);
    await showTable(2);

    expect(host().querySelector('.report-filter')).toBeNull();
    expect(host().textContent).toContain('No products are currently in stock.');
  });
});
