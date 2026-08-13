import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormatService } from '../../../core/format/format.service';
import { LanguageService } from '../../../core/i18n/language.service';
import {
  AuditServiceStub,
  ReportServiceStub,
  configureReportsPageTestBed,
  createReportsPageHelpers,
  productRow
} from './reports-page.fixtures';
import { ProfitTabState } from './profit-tab-state';
import { AnalyticsTabState } from './analytics-tab-state';
import { CashFlowTabState } from './cash-flow-tab-state';
import { DueTabState } from './due-tab-state';
import { LossTabState } from './loss-tab-state';
import { ReportsPageComponent } from './reports-page.component';
import { StockTabState } from './stock-tab-state';

/*
 * The reporting page's SHELL: what belongs to the page rather than to any one tab. Tab selection
 * and first-activation loading, the refresh that refetches only what is on screen, the chart/table
 * view machinery, the single loading bar and the single error banner every tab reports through,
 * and the chart context that rebuilds every option when the reader's language or number format
 * moves. The whole-page fetch-timing contracts live here permanently, because each asserts on the
 * page's entire call list rather than on one tab's: what loads on open, what refresh refetches,
 * and which switches do and do not trigger a second query.
 *
 * Each tab's own rendering, filters, presets, sorting and exports belong to its sibling:
 * the tab siblings reports-page.profit.spec.ts, reports-page.cash-flow.spec.ts,
 * reports-page.stock.spec.ts, reports-page.losses.spec.ts, reports-page.due-dates.spec.ts,
 * reports-page.changes.spec.ts, and reports-page.analytics.spec.ts.
 * Out of scope: the requests (report.service.spec.ts), the chart wrapper
 * (chart.component.spec.ts), the top-N rule (chart-data.spec.ts) and the profit drill-down
 * (profit-detail-dialog.component.spec.ts).
 */
describe('ReportsPageComponent', () => {
  let fixture: ComponentFixture<ReportsPageComponent>;
  let reports: ReportServiceStub;
  let audit: AuditServiceStub;

  const { render, host, activateTab, settle, showTable, optionOf, page, chooseAnalyticsProduct, showAnalytics } =
    createReportsPageHelpers(() => fixture, (value) => { fixture = value; });

  beforeEach(() => {
    // Only Date is faked: the period presets compute their bounds from today, and a test reading
    // the real clock would change its expected range every day. Timers stay real.
    vi.useFakeTimers({ toFake: ['Date'] });
    ({ reports, audit } = configureReportsPageTestBed({ open: vi.fn() }, vi.fn()));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ngOnInit_firstRender_loadsOnlyTheProfitTab', () => {
    render();

    // The page must not fire all seven report queries on open.
    expect(reports.calls).toEqual(['profitProducts', 'profitSuppliers']);
  });

  it('activate_stockTab_loadsStockOnFirstActivationOnly', async () => {
    render();
    await activateTab(2);
    expect(reports.calls).toContain('stockStatus');

    await activateTab(0);
    await activateTab(2);

    expect(reports.calls.filter((call) => call === 'stockStatus').length).toBe(1);
  });

  it('toggleView_tableSelected_showsTableAndHidesChart', async () => {
    render();
    expect(host().querySelector('.profit-table')).toBeNull();

    await showTable(0);

    expect(host().querySelector('.profit-table')).not.toBeNull();
    expect(host().querySelector('.profit-chart-card')).toBeNull();
  });

  it('toggleView_switchTabsAndReturn_preservesChosenView', async () => {
    render();
    await showTable(0);

    await activateTab(2);
    await activateTab(0);

    // The view is a per-tab choice, so leaving the tab must not silently undo it.
    expect(host().querySelector('.profit-table')).not.toBeNull();
  });

  it('refresh_onStockTab_refetchesOnlyThatTab', async () => {
    render();
    await activateTab(2);
    reports.calls = [];

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.reports-refresh')
      ?.click();
    fixture.detectChanges();

    expect(reports.calls).toEqual(['stockStatus']);
  });

  it('chartOptions_languageSwitched_rebuildWithTheOtherLanguagesLabels', async () => {
    // Eleven rows so topNWithRemainder produces the one chart label this page translates.
    reports.profitPayload = Array.from({ length: 11 }, (unused, index) => ({
      productId: index + 1,
      name: `Product ${index + 1}`,
      sku: `SKU-${index + 1}`,
      deleted: false,
      revenue: 100,
      cost: 40,
      grossProfit: 60 - index
    }));
    render();
    await activateTab(0);

    const labelsOf = () =>
      JSON.stringify((optionOf('profitOption') as unknown as { yAxis: { data: string[] } }).yAxis.data);
    expect(labelsOf()).toContain('Other');

    TestBed.inject(LanguageService).setLanguage('de');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // The regression this slice fixes. Before it, the option was built once inside loadProfit with
    // translate.instant resolved and frozen in, and a language switch left it byte-identical -
    // measured, not assumed. Nothing refetches here: only the language changed.
    expect(labelsOf()).toContain('Sonstige');
    expect(labelsOf()).not.toContain('Other');
  });

  it('chartOptions_dataRefreshed_stillRebuild', async () => {
    render();
    await activateTab(0);
    expect(JSON.stringify(optionOf('profitOption'))).toContain('Widget');

    // The behaviour the imperative version had, pinned: deriving the options must not cost the
    // rebuild a refetch already triggered.
    reports.profitPayload = [
      { productId: 9, name: 'Sprocket', sku: 'SKU-9', deleted: false, revenue: 10, cost: 4, grossProfit: 6 }
    ];
    host().querySelector<HTMLButtonElement>('.reports-refresh')?.click();
    await settle();

    expect(JSON.stringify(optionOf('profitOption'))).toContain('Sprocket');
    expect(JSON.stringify(optionOf('profitOption'))).not.toContain('Widget');
  });

  /*
   * The values, rather than the labels the block above covers.
   *
   * <p>Asserted by CALLING the callbacks the option hands ECharts, with values the fixtures do not
   * contain. Nothing else can: the formatters are functions, so the option itself carries no
   * rendered string, and the fake engine paints nothing to read back. The values are chosen to be
   * ambiguous between the two locales - 1234.56 reads as a thousand or as one-and-a-bit depending
   * entirely on who is looking, which is the defect ADR 031 is about.
   */
  describe('chart values', () => {
    // Both preferences are set explicitly in every test below, because both persist to storage and
    // this file shares its origin with every other spec in the worker.
    afterEach(() => localStorage.clear());

    /*
     * Intl separates a currency symbol and a percent sign with a no-break space, and which one it
     * uses varies by ICU build. Normalised for the same reason FormatService's own spec does it.
     */
    const SPACES = new Set([0x20, 0xa0, 0x202f]);

    function plain(value: string): string {
      return [...value].map((ch) => (SPACES.has(ch.codePointAt(0) ?? 0) ? ' ' : ch)).join('');
    }

    function setFormats(lang: 'en' | 'de', numbers: 'auto' | 'en' | 'de'): void {
      TestBed.inject(LanguageService).setLanguage(lang);
      TestBed.inject(FormatService).setNumberFormat(numbers);
      fixture.detectChanges();
    }

    /*
     * The callbacks one option hands ECharts, read by the name the page has always called it.
     *
     * <p>Every tab's option lives on that tab's collaborator rather than on the component
     * (ADR 039), so the name is routed to its owner. The conversion sequence is complete, so this
     * map is the suite's named-access surface for the options and the fall-through below answers
     * only for a name nobody has claimed. The names these cases pass are unchanged, which is the
     * point.
     */
    function formattersOf(name: string): FormatProbe {
      const owners: Record<string, () => FormatProbe> = {
        marginOption: () => fixture.debugElement.injector.get(ProfitTabState).marginOption() as FormatProbe,
        profitOption: () => fixture.debugElement.injector.get(ProfitTabState).option() as FormatProbe,
        stockOption: () => fixture.debugElement.injector.get(StockTabState).option() as FormatProbe,
        lossOption: () => fixture.debugElement.injector.get(LossTabState).option() as FormatProbe,
        dueOption: () => fixture.debugElement.injector.get(DueTabState).option() as FormatProbe,
        cashFlowOption: () => fixture.debugElement.injector.get(CashFlowTabState).option() as FormatProbe,
        analyticsStockOption: () =>
          fixture.debugElement.injector.get(AnalyticsTabState).stockOption() as FormatProbe,
        analyticsPriceOption: () =>
          fixture.debugElement.injector.get(AnalyticsTabState).priceOption() as FormatProbe
      };
      if (owners[name]) {
        return owners[name]();
      }
      const page = fixture.componentInstance as unknown as Record<string, () => FormatProbe>;
      return page[name]();
    }

    function tooltipOf(name: string, value: number): string {
      return plain(formattersOf(name).tooltip?.valueFormatter?.(value) ?? '');
    }

    function xTickOf(name: string, value: string | number): string {
      return plain(formattersOf(name).xAxis?.axisLabel?.formatter?.(value) ?? '');
    }

    function yTickOf(name: string, value: number): string {
      return plain(formattersOf(name).yAxis?.axisLabel?.formatter?.(value) ?? '');
    }

    /* Puts the three tabs the triangle reads - profit, due dates, analytics - on screen. */
    async function showTheThreeShapes(): Promise<void> {
      render();
      await activateTab(0);
      await activateTab(4);
      await activateTab(6);
      await chooseAnalyticsProduct(3);
      await showAnalytics();
    }

    it('chartValues_germanInterfaceOnAuto_renderMoneyCountsAndDatesTheGermanWay', async () => {
      await showTheThreeShapes();

      setFormats('de', 'auto');

      expect(tooltipOf('profitOption', 1234.56)).toBe('1.234,56 €');
      expect(yTickOf('analyticsStockOption', 1234)).toBe('1.234');
      expect(xTickOf('dueOption', '2026-03-01')).toBe('01.03.2026');
    });

    it('chartValues_englishInterfaceOnAuto_renderMoneyCountsAndDatesTheEnglishWay', async () => {
      await showTheThreeShapes();

      setFormats('en', 'auto');

      expect(tooltipOf('profitOption', 1234.56)).toBe('€1,234.56');
      expect(yTickOf('analyticsStockOption', 1234)).toBe('1,234');
      expect(xTickOf('dueOption', '2026-03-01')).toBe('03/01/2026');
    });

    it('chartValues_germanInterfaceWithEnglishNumbers_followTheOverrideNotTheLanguage', async () => {
      await showTheThreeShapes();

      setFormats('de', 'en');

      // The third corner of the triangle, and the one a language-only implementation gets wrong:
      // the interface is German and every figure in it is English, because the reader said so.
      // The date follows too - it is on 'auto', and 'auto' means the effective number locale.
      expect(tooltipOf('profitOption', 1234.56)).toBe('€1,234.56');
      expect(yTickOf('analyticsStockOption', 1234)).toBe('1,234');
      expect(xTickOf('dueOption', '2026-03-01')).toBe('03/01/2026');
    });

    it('chartValues_stockHistory_areCountsRatherThanMoney', async () => {
      await showTheThreeShapes();
      setFormats('de', 'auto');

      // The one chart on this page whose values are units. A currency symbol here would state that
      // the warehouse holds 1234 euros of nothing in particular - so the assertion is the whole
      // string, grouped the German way and carrying no symbol, rather than an absence of one.
      expect(tooltipOf('analyticsStockOption', 1234)).toBe('1.234');
      expect(yTickOf('analyticsStockOption', 1234)).toBe('1.234');
    });

    it('chartValues_formatOverrideSwitchedMidSpec_rebuildTheOptionInTheOtherLocale', async () => {
      render();
      await activateTab(0);
      setFormats('de', 'auto');
      const before = formattersOf('profitOption');
      expect(tooltipOf('profitOption', 1234.56)).toBe('1.234,56 €');

      TestBed.inject(FormatService).setNumberFormat('en');
      fixture.detectChanges();

      // Reactivity for free from the #168 seam: nothing refetched and no data changed, only the
      // preference.
      //
      // The IDENTITY is the assertion that matters, and the reading beside it would pass without
      // it - measured. A formatter closes over the service rather than over a locale, so calling
      // the old option's callback after the switch already returns English. But nothing calls it:
      // ChartComponent hands echarts an option only when this derivation re-runs, so an option
      // that is still the object it was is a chart still showing the German labels it painted.
      // That is what the format reads in chartContext buy, and this is what pins them.
      const after = formattersOf('profitOption');
      expect(after).not.toBe(before);
      expect(tooltipOf('profitOption', 1234.56)).toBe('€1,234.56');
    });

    it('chartValues_dueDateAxis_keepsIsoKeysAsDataAndFormatsOnlyTheLabels', async () => {
      render();
      await activateTab(4);
      setFormats('de', 'auto');

      // Sorting and the series lookup both index by the raw key, so the DATA must stay raw - the
      // formatting is a rendering decision and lives only in the callback.
      const axis = formattersOf('dueOption').xAxis;
      expect(axis?.data).toEqual(['2026-03-01']);
      expect(plain(axis?.axisLabel?.formatter?.('2026-03-01') ?? '')).toBe('01.03.2026');
    });

    it('chartValues_cashFlowAxis_readsMonthKeysAsMonths', async () => {
      render();
      await activateTab(1);

      setFormats('de', 'auto');
      // The month keys are the shape FormatService did not cover; formatMonth is the addition.
      expect(formattersOf('cashFlowOption').xAxis?.data).toEqual(['2026-02', '2026-03']);
      expect(xTickOf('cashFlowOption', '2026-03')).toBe('März 2026');

      setFormats('en', 'auto');
      expect(xTickOf('cashFlowOption', '2026-03')).toBe('Mar 2026');
    });

    /*
     * Every value surface on the page in one pass, which is the point: the routing decision - is
     * this figure money or a count - is made once per axis and per tooltip, and the ones the
     * triangle above does not reach are exactly where a wrong one would survive unnoticed.
     */
    it('chartValues_everySurface_routeMoneyToCurrencyAndUnitsToCounts', async () => {
      await showTheThreeShapes();
      await activateTab(1);
      await activateTab(2);
      await activateTab(3);
      setFormats('de', 'auto');

      const money = ['profitOption', 'stockOption', 'lossOption', 'dueOption', 'cashFlowOption', 'analyticsPriceOption'];
      for (const name of money) {
        expect(tooltipOf(name, 1234.56)).toBe('1.234,56 €');
      }

      // The value axis, whichever way each chart is oriented: the two bar charts lie on their
      // side, so their VALUE axis is x and their category axis is y.
      expect(xTickOf('profitOption', 1234.56)).toBe('1.234,56 €');
      expect(xTickOf('stockOption', 1234.56)).toBe('1.234,56 €');
      expect(yTickOf('dueOption', 1234.56)).toBe('1.234,56 €');
      expect(yTickOf('cashFlowOption', 1234.56)).toBe('1.234,56 €');
      expect(yTickOf('analyticsPriceOption', 1234.56)).toBe('1.234,56 €');

      // The date axes, all reading the reader's own order and separators from a raw ISO key.
      expect(xTickOf('analyticsPriceOption', '2026-03-01')).toBe('01.03.2026');
      expect(xTickOf('analyticsStockOption', '2026-03-01')).toBe('01.03.2026');

      // And the one exception, stated as a whole string rather than as an absent symbol.
      expect(tooltipOf('analyticsStockOption', 1234)).toBe('1.234');
    });

    it('chartValues_marginGauge_readsThePercentInTheReadersOwnNumbers', async () => {
      render();
      await activateTab(0);

      setFormats('de', 'auto');
      const detailOf = () => formattersOf('marginOption').series?.[0]?.detail?.formatter;
      // 42.5 is what the dial itself is set to; only the reading changes. The literal '{value}%'
      // this replaces printed 42.5% at a German reader who writes 42,5 %.
      expect(plain(detailOf()?.(42.5) ?? '')).toBe('42,5 %');

      setFormats('en', 'auto');
      expect(plain(detailOf()?.(42.5) ?? '')).toBe('42.5%');
    });
  });

  it('analytics_activatedWithNothingShown_clearsTheLoadingBar', async () => {
    render();

    await activateTab(6);

    // loadTab raises the bar for every tab; the analytics tab is the only one that can then decide
    // it has nothing to fetch, so it has to lower it again rather than leave it running forever
    expect(host().querySelector('mat-progress-bar')).toBeNull();
  });

  it('analytics_searchFails_leavesTheTabUsable', async () => {
    render();
    await activateTab(6);
    reports.supplierProductsFails = true;

    page().setAnalyticsSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    await settle();

    // A failing suggestion query is not the tab's error: nothing was asked for yet.
    expect(host().querySelector('mat-progress-bar')).toBeNull();
    expect(host().querySelector('.reports-error')).toBeNull();
  });

  it('cashflow_productScoped_refetchesTimelineWithParam', async () => {
    render();
    await activateTab(1);

    page().setCashFlowSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    page().setCashFlowProduct(productRow(3));
    await settle();

    // the timeline is refetched scoped; the first call was the unscoped one on activation
    expect(reports.timelineProductIds).toEqual([undefined, 3]);
    // the table is untouched: it already answers the per-product question in rows
    expect(reports.calls.filter((call) => call === 'cashFlow')).toEqual([]);
    expect(host().textContent).toContain('Product 3');
  });

  it('cashflow_scopedFetchFails_clearsTheLoadingBarAndReportsIt', async () => {
    render();
    await activateTab(1);
    reports.timelineFailsWhenScoped = true;

    page().setCashFlowSupplier({ id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '' });
    page().setCashFlowProduct(productRow(3));
    await settle();

    // Unlike a suggestion query, this IS the report the reader asked for, so it surfaces - but the
    // bar comes down either way. Pinned because the analytics tab lost exactly this property.
    expect(host().querySelector('mat-progress-bar')).toBeNull();
    expect(host().querySelector('.reports-error')?.textContent).toContain('Report unavailable.');
  });

  it('tableView_firstSwitch_lazilyLoadsProducts', async () => {
    render();
    await activateTab(1);

    // the chart half needs only the timeline; the per-product query waits for a reader who wants it
    expect(reports.calls).not.toContain('cashFlow');

    await showTable(1);

    expect(reports.cashFlowRanges).toEqual([[undefined, undefined]]);
  });

  // Each tab fires its queries in order and every failure overwrites the banner, so the message
  // asserted is the last one to land - which is also what a reader would see.
  it('profitTab_bothQueriesFail_reportsItAndStopsTheLoadingBar', async () => {
    reports.failing.add('profitProducts').add('profitSuppliers');

    render();
    await settle();

    expectFailureBanner('profitSuppliers is unavailable.');
  });

  it('stockTab_queryFails_reportsItAndStopsTheLoadingBar', async () => {
    reports.failing.add('stockStatus');
    render();

    await activateTab(2);

    expectFailureBanner('stockStatus is unavailable.');
  });

  it('lossesTab_queryFails_reportsItAndStopsTheLoadingBar', async () => {
    reports.failing.add('losses');
    render();

    await activateTab(3);

    expectFailureBanner('losses is unavailable.');
  });

  it('lossRemarkSection_queryFails_reportsItAndLeavesTheProductTableIntact', async () => {
    // Only the breakdown rejects. It reports through the tab's single banner rather than adding a
    // second error line, and the per-product half - which answered fine - stays on screen.
    reports.failing.add('lossesByRemark');
    render();

    await activateTab(3);

    expectFailureBanner('lossesByRemark is unavailable.');
    expect(host().querySelector('.loss-remark-table')).toBeNull();
    expect(host().querySelector('.losses-remark-empty')).not.toBeNull();
    expect(fixture.debugElement.injector.get(LossTabState).rows())
      .toHaveLength(2);
  });

  it('dueTab_allThreeQueriesFail_reportsItAndStopsTheLoadingBar', async () => {
    reports.failing.add('dueDates').add('dueSoon').add('overdue');
    render();

    await activateTab(4);

    expectFailureBanner('overdue is unavailable.');
  });

  it('changesTab_queryFails_reportsItAndStopsTheLoadingBar', async () => {
    audit.failing.add('changes');
    render();

    await activateTab(5);

    expectFailureBanner('changes is unavailable.');
  });

  it('analyticsTab_bothSeriesFail_reportsItAndStopsTheLoadingBar', async () => {
    reports.failing.add('stockHistory');
    audit.failing.add('productChanges');
    render();
    await activateTab(6);

    await chooseAnalyticsProduct(3);
    await showAnalytics();

    expectFailureBanner('productChanges is unavailable.');
  });

  it('load_requestInFlight_showsTheLoadingBar', async () => {
    reports.profitPayload = [];
    reports.holdProfit = true;
    render();
    await settle();

    // The bar is the only thing telling a reader the page is working rather than empty.
    expect(host().querySelector('mat-progress-bar')).not.toBeNull();
  });

  it('cashFlowTab_queryFails_reportsItAndLeavesNoTable', async () => {
    reports.failing.add('cashFlow');
    render();

    await activateTab(1);
    await showTable(1);

    // The report signal stays null, so the table falls back to no rows rather than throwing.
    expect(host().querySelector('.reports-error')?.textContent?.trim()).toBe('cashFlow is unavailable.');
    expect(host().querySelector('.cash-flow-table')).toBeNull();
  });

  /* The banner every tab reports a failed load through, and the bar that must stop with it. */
  function expectFailureBanner(message: string): void {
    expect(host().querySelector('.reports-error')?.textContent?.trim()).toBe(message);
    expect(host().querySelector('mat-progress-bar')).toBeNull();
  }
});

/*
 * The formatting callbacks an option carries. Typed loosely on purpose: these mirror the parts of
 * echarts' own option shape the value specs invoke, and importing its types here would tie the
 * spec to a structure only ChartComponent is supposed to know.
 */
interface FormatProbe {
  tooltip?: { valueFormatter?: (value: unknown) => string };
  xAxis?: { data?: string[]; axisLabel?: { formatter?: (value: string | number) => string } };
  yAxis?: { axisLabel?: { formatter?: (value: number) => string } };
  series?: { detail?: { formatter?: (value: number) => string } }[];
}
