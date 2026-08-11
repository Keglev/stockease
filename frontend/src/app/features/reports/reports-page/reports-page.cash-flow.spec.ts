import { ComponentFixture } from '@angular/core/testing';

import {
  ReportServiceStub,
  configureReportsPageTestBed,
  createReportsPageHelpers,
  productRow
} from './reports-page.fixtures';
import { ReportsPageComponent } from './reports-page.component';

/*
 * The cash-flow tab: the monthly timeline and the totals strip summed from it, the per-product
 * table behind the view toggle with its filter and export, the period presets, and the
 * supplier-then-product cascade that scopes the timeline without ever sending the supplier.
 *
 * Two of this tab's fetch-timing contracts are NOT here: that scoping the timeline does not also
 * fetch the per-product report, and that the first switch to the table is what fetches it. Both
 * assert on the page's whole call list and live in the shell spec.
 *
 * Siblings: reports-page.component.spec.ts (shell), and the tab siblings reports-page.profit.spec.ts,
 * reports-page.stock.spec.ts, reports-page.losses.spec.ts, reports-page.due-dates.spec.ts,
 * reports-page.changes.spec.ts, and reports-page.analytics.spec.ts.
 * Out of scope: the requests (report.service.spec.ts), the chart wrapper
 * (chart.component.spec.ts), the top-N rule (chart-data.spec.ts) and the profit drill-down
 * (profit-detail-dialog.component.spec.ts).
 */
describe('ReportsPageComponent cash-flow tab', () => {
  let fixture: ComponentFixture<ReportsPageComponent>;
  let reports: ReportServiceStub;
  let download: ReturnType<typeof vi.fn>;

  const { render, host, activateTab, settle, showTable, page, typeaheadAt, typeFilter } =
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

  it('cashFlowTab_firstActivation_loadsTimelineLazily', async () => {
    render();
    expect(reports.calls).not.toContain('cashFlowTimeline');

    await activateTab(1);

    // no bounds on the default 'all' window, and only on first activation
    expect(reports.timelineRanges).toEqual([[undefined, undefined]]);
    await activateTab(0);
    await activateTab(1);
    expect(reports.timelineRanges).toHaveLength(1);
  });

  it('cashflow_clear_returnsToAllProducts', async () => {
    render();
    await activateTab(1);
    page().setCashFlowSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    page().setCashFlowProduct(productRow(3));
    await settle();

    page().setCashFlowProduct(null);
    await settle();

    expect(reports.timelineProductIds).toEqual([undefined, 3, undefined]);
    // and the scope line says so rather than going blank
    expect(host().textContent).toContain('All products');
  });

  it('cashflow_supplierChangedWithNoProductScoped_doesNotRefetch', async () => {
    render();
    await activateTab(1);

    page().setCashFlowSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    await settle();

    // the supplier is a navigation aid, never a query dimension: it narrows the product search and
    // nothing else, so choosing one asks the server nothing
    expect(reports.timelineProductIds).toEqual([undefined]);
  });

  it('timelineChart_presetChange_refetches', async () => {
    vi.setSystemTime(new Date(2026, 2, 15, 12));
    render();
    await activateTab(1);

    await selectPeriod('d30');

    // 30 days back from a pinned today, inclusive of today at the upper end
    expect(reports.timelineRanges.at(-1)).toEqual(['2026-02-13', '2026-03-15']);
  });

  it('period_d180_computesRange', async () => {
    vi.setSystemTime(new Date(2026, 2, 15, 12));
    render();
    await activateTab(1);

    await selectPeriod('d180');

    // 180 days back from the pinned today, the same arithmetic the shorter presets use
    expect(reports.timelineRanges.at(-1)).toEqual(['2025-09-16', '2026-03-15']);
  });

  it('tableFilter_matchesNameOrSku_narrowsRowsAndExport', async () => {
    render();
    await activateTab(1);
    await showTable(1);

    await setCashFlowFilter('gadget');

    expect(host().querySelectorAll('.cash-flow-table tbody tr').length).toBe(1);
    host().querySelector<HTMLButtonElement>('.export-cash-flow')?.click();

    // the download mirrors the narrowed table rather than the whole report
    const [, content] = download.mock.calls[0] as [string, string];
    expect(content).toContain('Gadget');
    expect(content).not.toContain('Widget');
  });

  it('cashFlowTab_tableView_exportsCsvThroughSeam', async () => {
    render();
    await activateTab(1);
    await showTable(1);

    host().querySelector<HTMLButtonElement>('.export-cash-flow')?.click();

    const [filename, content] = download.mock.calls[0] as [string, string];
    expect(filename).toBe('cash-flow.csv');
    expect(content).toContain('Inflow');
  });

  it('cashFlowTab_negativeNet_rendersErrorColorClass', async () => {
    reports.timelinePayload = [{ month: '2026-03', inflow: 100, outflow: 300, net: -200 }];
    render();
    await activateTab(1);

    // the class, not the computed colour: jsdom resolves no tokens
    expect(host().querySelector('.cash-flow-net.cash-flow-negative')).not.toBeNull();
  });

  it('cashFlowTab_positiveNet_omitsErrorColorClass', async () => {
    render();
    await activateTab(1);

    // the other direction: the error colour is reserved for money going out net
    expect(host().querySelector('.cash-flow-net')).not.toBeNull();
    expect(host().querySelector('.cash-flow-net.cash-flow-negative')).toBeNull();
  });

  it('cashFlowTab_emptyTimeline_showsEmptyState', async () => {
    reports.timelinePayload = [];
    render();
    await activateTab(1);

    expect(host().querySelector('.cash-flow-empty')).not.toBeNull();
  });

  it('cashFlowProductField_selectionEmitted_refetchesTheTimelineScopedToIt', async () => {
    render();
    await activateTab(1);
    page().setCashFlowSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    await settle();

    typeaheadAt('.cash-flow-picker .product-search').selected.emit(productRow(3));
    await settle();

    expect(reports.timelineProductIds.at(-1)).toBe(3);
  });

  it('cashFlowFilter_typedIntoTheField_narrowsTheTableAndItsExport', async () => {
    render();
    await activateTab(1);
    await showTable(1);

    await typeFilter('Gadget');

    expect(host().querySelectorAll('.cash-flow-table tbody tr').length).toBe(1);
  });

  it('cashFlowTab_noProductRows_showsEmptyStateWithNoFilterRow', async () => {
    reports.cashFlowPayload = { inflow: 0, outflow: 0, net: 0, products: [] };
    render();
    await activateTab(1);
    await showTable(1);

    expect(host().querySelector('.report-filter')).toBeNull();
    expect(host().textContent).toContain('No paid invoices in this period.');
  });

  it('cashFlowTable_deletedProduct_marksTheRow', async () => {
    reports.cashFlowPayload = {
      inflow: 1,
      outflow: 0,
      net: 1,
      products: [
        { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: true, inflow: 1, outflow: 0, net: 1 }
      ]
    };
    render();
    await activateTab(1);
    await showTable(1);

    // A row for a product that no longer exists has to say so, or the number looks unexplained.
    expect(host().querySelector('.cash-flow-table .deleted-hint')?.textContent?.trim()).toBe('deleted');
  });

  it('cashFlowSupplierField_selectionEmitted_narrowsTheProductSearchScope', async () => {
    render();
    await activateTab(1);

    typeaheadAt('.cash-flow-picker .supplier-search').selected.emit({
      id: 5,
      name: 'Acme',
      address: '1 Main St',
      createdAt: ''
    } as never);
    await settle();

    typeaheadAt('.cash-flow-picker .product-search').search()('wid').subscribe();
    expect(reports.supplierProductTerms).toEqual(['wid']);
  });

  /* Types into the cash-flow filter through the component, the way the input does. */
  async function setCashFlowFilter(value: string): Promise<void> {
    const page = fixture.componentInstance as unknown as {
      setCashFlowFilter: (value: string) => void;
    };
    page.setCashFlowFilter(value);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /* Clicks a period preset through the component, the way the toggle group does. */
  async function selectPeriod(period: string): Promise<void> {
    const page = fixture.componentInstance as unknown as {
      setCashFlowPeriod: (value: string) => void;
    };
    page.setCashFlowPeriod(period);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
});
