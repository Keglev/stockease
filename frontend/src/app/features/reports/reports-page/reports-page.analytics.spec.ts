import { ComponentFixture } from '@angular/core/testing';

import { SupplierProduct, SupplierResponse } from '../../../core/api/api-models';
import { TypeaheadComponent } from '../../../shared/typeahead/typeahead.component';
import {
  AuditServiceStub,
  PRODUCT_CHANGES,
  ReportServiceStub,
  SupplierServiceStub,
  configureReportsPageTestBed,
  createReportsPageHelpers,
  productRow
} from './reports-page.fixtures';
import { ReportsPageComponent } from './reports-page.component';

/*
 * The analytics tab: the supplier-then-product cascade, the Show gate that separates choosing a
 * product from asking for it, the price series derived from the audit trail and the stock-versus-
 * sales series from the reporting endpoint, and the period presets that refetch only what is
 * already on screen.
 *
 * Two of its contracts are page-level and belong to the shell spec: that activating it with
 * nothing shown lowers the loading bar the shell raised, and that a failing suggestion query is
 * not the tab's error.
 *
 * Siblings: reports-page.component.spec.ts (shell), and the tab siblings reports-page.profit.spec.ts,
 * reports-page.cash-flow.spec.ts, reports-page.stock.spec.ts, reports-page.losses.spec.ts,
 * reports-page.due-dates.spec.ts, and reports-page.changes.spec.ts.
 * Out of scope: the requests (report.service.spec.ts), the chart wrapper
 * (chart.component.spec.ts), the top-N rule (chart-data.spec.ts) and the profit drill-down
 * (profit-detail-dialog.component.spec.ts).
 */
describe('ReportsPageComponent analytics tab', () => {
  let fixture: ComponentFixture<ReportsPageComponent>;
  let reports: ReportServiceStub;
  let audit: AuditServiceStub;
  let suppliers: SupplierServiceStub;

  const { render, host, activateTab, settle, optionOf, page, typeaheadAt, chooseAnalyticsProduct, showAnalytics } =
    createReportsPageHelpers(() => fixture, (value) => { fixture = value; });

  beforeEach(() => {
    // Only Date is faked: the period presets compute their bounds from today, and a test reading
    // the real clock would change its expected range every day. Timers stay real.
    vi.useFakeTimers({ toFake: ['Date'] });
    ({ reports, audit, suppliers } = configureReportsPageTestBed({ open: vi.fn() }, vi.fn()));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('analyticsTab_noProduct_showsSelectPromptAndFetchesNoCatalogue', async () => {
    render();
    await activateTab(6);

    // The tab now fetches nothing at all on activation: the pickers query as they are typed into,
    // where the old full-list select pulled the whole catalogue down to offer one row of it.
    expect(host().querySelector('.analytics-prompt')).not.toBeNull();
    expect(reports.calls).not.toContain('stockHistory');
    expect(reports.supplierProductTerms).toEqual([]);
  });

  it('analytics_productChosenWithoutShow_fetchesNothing', async () => {
    render();
    await activateTab(6);

    await chooseAnalyticsProduct(3);

    // choosing states an interest; the Show button is where the user asks. Until then the tab is
    // exactly as it was, prompt included.
    expect(reports.historyIds).toEqual([]);
    expect(audit.productChangeIds).toEqual([]);
    expect(host().querySelector('.analytics-prompt')).not.toBeNull();
  });

  it('analytics_show_fetchesBothSeries', async () => {
    render();
    await activateTab(6);
    await chooseAnalyticsProduct(3);

    await showAnalytics();

    // the stock series from the reporting endpoint, the price series from the audit trail
    expect(reports.historyIds).toEqual([3]);
    expect(audit.productChangeIds).toEqual([3]);
    expect(host().querySelector('.analytics-prompt')).toBeNull();
  });

  it('analytics_productSwitchedWithoutShow_keepsShowingTheOldOne', async () => {
    render();
    await activateTab(6);
    await chooseAnalyticsProduct(3);
    await showAnalytics();

    await chooseAnalyticsProduct(4);

    // switching the picked product is not a request, so nothing is refetched for it
    expect(reports.historyIds).toEqual([3]);
  });

  it('analytics_presetChangeWhileShown_refetches', async () => {
    vi.setSystemTime(new Date(2026, 2, 15, 12));
    render();
    await activateTab(6);
    await chooseAnalyticsProduct(3);
    await showAnalytics();

    await selectAnalyticsPeriod('d90');

    // presets re-query the product already shown: that is the user's standing request, and the
    // window is which slice of it they want rather than a new subject
    expect(reports.historyRanges.at(-1)).toEqual(['2025-12-15', '2026-03-15']);
    expect(reports.historyIds).toEqual([3, 3]);
  });

  it('analytics_presetChangeBeforeShow_fetchesNothing', async () => {
    render();
    await activateTab(6);
    await chooseAnalyticsProduct(3);

    await selectAnalyticsPeriod('d90');

    // there is no standing request to re-run yet
    expect(reports.historyIds).toEqual([]);
  });

  it('analyticsTab_priceRowsUnparseable_skipsThem', async () => {
    audit.productChangePayload = [
      { ...PRODUCT_CHANGES[0], newValue: 'not a price' },
      PRODUCT_CHANGES[2]
    ];
    render();
    await activateTab(6);
    await chooseAnalyticsProduct(3);
    await showAnalytics();

    // one usable point is left, and one point is not a history: the no-changes state shows instead
    // of a line drawn through a value that was never a number
    expect(optionOf('analyticsPriceOption')).toBeNull();
    expect(host().querySelector('.analytics-no-prices')).not.toBeNull();
  });

  it('analyticsProductSearch_supplierChosen_queriesThatSuppliersCatalogueOnly', async () => {
    render();
    await activateTab(6);
    page().setAnalyticsSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    await settle();

    typeaheadAt('.analytics-picker .product-search').search()('wid').subscribe();

    expect(reports.supplierProductTerms).toEqual(['wid']);
  });

  it('analyticsProductSearch_noSupplierChosen_asksTheServerNothing', async () => {
    render();
    await activateTab(6);

    let emitted: SupplierProduct[] | undefined;
    typeaheadAt('.analytics-picker .product-search').search()('wid').subscribe((rows) => (emitted = rows));

    // No supplier means no scope to search within, so the field answers empty without a request.
    expect(emitted).toEqual([]);
    expect(reports.supplierProductTerms).toEqual([]);
  });

  it('analyticsProductField_selectionEmitted_enablesTheShowButton', async () => {
    render();
    await activateTab(6);
    page().setAnalyticsSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    await settle();

    typeaheadAt('.analytics-picker .product-search').selected.emit(productRow(3));
    await settle();

    expect(host().querySelector<HTMLButtonElement>('.analytics-show')?.disabled).toBe(false);
  });

  it('analyticsShowButton_clicked_fetchesBothSeries', async () => {
    render();
    await activateTab(6);
    await chooseAnalyticsProduct(3);

    host().querySelector<HTMLButtonElement>('.analytics-show')?.click();
    await settle();

    expect(reports.historyIds).toEqual([3]);
    expect(audit.productChangeIds).toEqual([3]);
  });

  it('analyticsSupplierField_selectionEmitted_enablesTheProductField', async () => {
    render();
    await activateTab(6);
    expect(host().querySelector<HTMLInputElement>('.analytics-picker .product-search input')?.disabled).toBe(true);

    typeaheadAt('.analytics-picker .supplier-search').selected.emit({
      id: 5,
      name: 'Acme',
      address: '1 Main St',
      createdAt: ''
    } as never);
    await settle();

    expect(host().querySelector<HTMLInputElement>('.analytics-picker .product-search input')?.disabled).toBe(false);
  });

  it('supplierSearch_typed_queriesTheSupplierServiceAndLabelsTheRows', async () => {
    render();
    await activateTab(6);
    const field = typeaheadAt('.analytics-picker .supplier-search') as unknown as TypeaheadComponent<SupplierResponse>;

    field.search()('acm').subscribe();

    expect(suppliers.terms).toEqual(['acm']);
    // The panel shows names, not ids: the label function is what makes the list readable.
    expect(field.displayWith()({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' })).toBe('Acme');
  });

  it('productSearch_panelRows_areLabelledByProductName', async () => {
    render();
    await activateTab(6);

    expect(typeaheadAt('.analytics-picker .product-search').displayWith()(productRow(3))).toBe('Product 3');
  });

  it('analyticsChart_noStockHistory_rendersEmptyStateInsteadOfAnEmptyChart', async () => {
    reports.stockHistoryPayload = [];
    render();
    await activateTab(6);

    await chooseAnalyticsProduct(3);
    await showAnalytics();

    expect(optionOf('analyticsStockOption')).toBeNull();
  });

  /* Clicks an analytics period preset through the component, the way the toggle group does. */
  async function selectAnalyticsPeriod(period: string): Promise<void> {
    const page = fixture.componentInstance as unknown as {
      setAnalyticsPeriod: (value: string) => void;
    };
    page.setAnalyticsPeriod(period);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
});
