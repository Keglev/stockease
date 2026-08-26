import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApiError } from '../../core/api/api-envelope';
import { BreakpointObserverStub } from '../../testing/breakpoint-testing';
import { DashboardComponent } from './dashboard.component';
import {
  chartHeights,
  configureDashboardTestBed,
  HealthServiceStub,
  host,
  kpiValues,
  MatDialogStub,
  PROFIT,
  ProductServiceStub,
  ReportServiceStub,
  hasSkeleton,
  holdDashboardSources,
  isBusy,
  showDueList,
  skeletons,
  textOf,
  WIDGET
} from './dashboard.fixtures';

/*
 * The first screen after login: each KPI reads its own source, a failed load shows a dash rather than a
 * number, and refresh re-reads everything - including the due rows, but only once they have been asked
 * for.
 * Out of scope: the two cards' own views and the figures inside them (due-card.component.spec.ts and
 * profit-card.component.spec.ts), health, which the footer owns and this page deliberately does not poll
 * (footer.component.spec.ts), and the low-stock dialog (low-stock-dialog.component.spec.ts).
 */
describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let reports: ReportServiceStub;
  let products: ProductServiceStub;
  let health: HealthServiceStub;
  let dialog: MatDialogStub;
  let breakpoints: BreakpointObserverStub;

  /*
   * The app is zoneless, so fakeAsync is unavailable and vitest's timers stand in for any rxjs
   * timer the component might start. They must be faked before it is created.
   */
  function render(): void {
    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    ({ reports, products, health, dialog, breakpoints } = configureDashboardTestBed());
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('ngOnInit_pagedEnvelope_showsTotalElementsAsProductCount', () => {
    render();

    // The count is the envelope's totalElements, not the length of the one-row payload.
    expect(textOf(fixture, '.kpi-products .kpi-value')).toContain('42');
  });

  it('kpi_profitRows_sumsGrossProfit', () => {
    render();

    // summed over every row the profit report returned, not over the ten the chart plots
    // The full rendered amount, so the language pinned in beforeEach also pins the format.
    expect(textOf(fixture, '.kpi-gross-profit .kpi-value').trim()).toBe('€85.00');
  });

  it('kpi_negativeProfitSum_rendersErrorColorClass', () => {
    reports.profitPayload = [{ ...PROFIT[0], grossProfit: -40 }];
    render();

    // the class, not the computed colour: jsdom resolves no tokens
    expect(host(fixture).querySelector('.kpi-gross-profit .kpi-negative')).not.toBeNull();
  });

  it('kpi_positiveProfitSum_omitsErrorColorClass', () => {
    render();

    // the other direction, so the assertion above cannot pass on an always-present class
    expect(host(fixture).querySelector('.kpi-gross-profit .kpi-value')).not.toBeNull();
    expect(host(fixture).querySelector('.kpi-gross-profit .kpi-negative')).toBeNull();
  });

  it('ngOnInit_overdueInvoices_showsRowCount', () => {
    render();

    expect(textOf(fixture, '.kpi-overdue .kpi-value').trim()).toBe('3');
  });

  it('ngOnInit_lowStockProducts_showsCountKpi', () => {
    render();

    expect(textOf(fixture, '.kpi-low-stock .kpi-value').trim()).toBe('1');
  });

  it('kpiLowStock_clicked_opensDialogWithLoadedRows', () => {
    render();

    host(fixture).querySelector<HTMLButtonElement>('.low-stock-open')?.click();

    // the rows already on the component, not a second request: the count and the list behind it
    // are one answer
    expect(products.lowStockCalls).toBe(1);
    expect(dialog.openCalls).toHaveLength(1);
    expect(dialog.openCalls[0].config?.data).toEqual({ products: [WIDGET] });
  });

  it('load_serverError_showsTheCatalogSentenceNotTheWireSentence', () => {
    // The fail() seat routes through the resolver now. Strong form: the catalog sentence present,
    // the wire sentence absent, and the two share no wording.
    products.pagedFailure = new ApiError('Dashboard is unavailable.', 500, undefined, undefined);
    render();

    const banner = textOf(fixture, '.dashboard-error').trim();
    expect(banner).toBe('A server error occurred. Please try again later.');
    expect(banner).not.toBe('Dashboard is unavailable.');
  });

  it('kpiLowStock_errorState_staysInert', () => {
    products.pagedFailure = new Error('Authentication required.');
    render();

    // the em dash means the rows never loaded, so there is nothing the card could open
    expect(host(fixture).querySelector('.low-stock-open')).toBeNull();
    expect(textOf(fixture, '.kpi-low-stock .kpi-value').trim()).toBe('—');
  });

  it('refresh_clicked_reinvokesEveryReportLoad', () => {
    render();
    const afterInit = reports.calls;

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.dashboard-refresh')
      ?.click();
    fixture.detectChanges();

    // three, not four: the loss report left the dashboard with the KPI it fed
    expect(afterInit).toBe(3);
    expect(reports.calls).toBe(afterInit * 2);
  });

  it('render_always_leavesHealthPollingToTheFooter', () => {
    render();
    // Past the 30s cadence the removed card polled on, so a surviving subscription would show up.
    vi.advanceTimersByTime(90_000);

    // The footer carries the same dot and latency on every screen; a second poll here would fetch
    // a signal the operator can already see.
    expect(health.checks).toBe(0);
    expect(host(fixture).querySelector('.health-card')).toBeNull();
  });

  it('kpiCards_loadFailed_renderEmDashInsteadOfNumbers', () => {
    products.pagedFailure = new Error('Authentication required.');
    render();

    // scoped to the KPI values: a substring search over the whole page also hits icon ligatures
    // and the low-stock list, so it would pass or fail for reasons that are not this behaviour
    expect(kpiValues(fixture)).toEqual(['—', '—', '—', '—']);
    expect(kpiValues(fixture).join('')).not.toContain('42');
    expect(kpiValues(fixture).join('')).not.toContain('85.00');
  });

  it('kpiCards_loadedWithoutError_renderTheirNumbers', () => {
    render();

    // the other direction: the em dash appears only as a stand-in, never over real data
    expect(kpiValues(fixture).join('')).not.toContain('—');
    expect(kpiValues(fixture)[0]).toBe('42');
    expect(kpiValues(fixture)[2]).toBe('3');
  });

  it('refresh_afterListOpened_reReadsTheDueRows', () => {
    render();
    showDueList(fixture);

    host(fixture).querySelector<HTMLButtonElement>('.dashboard-refresh')?.click();
    fixture.detectChanges();

    // what is on screen must not survive a refresh unchanged
    expect(reports.dueSoonRequests).toBe(2);
  });

  it('refresh_listNeverOpened_stillSkipsDueSoon', () => {
    render();

    host(fixture).querySelector<HTMLButtonElement>('.dashboard-refresh')?.click();
    fixture.detectChanges();

    // the other direction: refresh must not quietly undo the laziness
    expect(reports.dueSoonRequests).toBe(0);
  });

  it('load_always_skipsTheLossReport', () => {
    render();

    // the gross-profit KPI comes from rows the chart already needed, so this request is gone
    expect(reports.lossRequests).toBe(0);
  });

  /*
   * The loading state. Every source is held open, so the page can be read at the moment it has
   * asked for everything and been told nothing - the interval a reader actually meets, and the one
   * the page used to fill with four zeros and two collapsed cards.
   */
  it('load_requestsInFlight_showsAPlaceholderInEveryCard', () => {
    holdDashboardSources({ reports, products, health, dialog, breakpoints });
    render();

    // four figures and both charts, and nothing else on the page grew one
    expect(skeletons(fixture)).toHaveLength(6);
    expect(hasSkeleton(fixture, '.kpi-products')).toBe(true);
    expect(hasSkeleton(fixture, '.kpi-low-stock')).toBe(true);
    expect(hasSkeleton(fixture, '.kpi-overdue')).toBe(true);
    expect(hasSkeleton(fixture, '.kpi-gross-profit')).toBe(true);
    expect(hasSkeleton(fixture, '.chart-profit')).toBe(true);
    expect(hasSkeleton(fixture, '.chart-due-dates')).toBe(true);
  });

  it('load_requestsInFlight_showsNoZerosAndNoDashes', () => {
    holdDashboardSources({ reports, products, health, dialog, breakpoints });
    render();

    // The whole point: a figure that is not known yet is not written down as a figure. A zero here
    // is indistinguishable from a real zero, and the dash means the load failed.
    const values = kpiValues(fixture).join(' ');
    expect(values).not.toContain('0');
    expect(values).not.toContain('—');
  });

  it('load_requestsInFlight_marksEachCardBusyForScreenReaders', () => {
    holdDashboardSources({ reports, products, health, dialog, breakpoints });
    render();

    // The placeholder is aria-hidden decoration, so without this the wait is silent to a reader
    // who cannot see the shimmer.
    expect(isBusy(fixture, '.kpi-products')).toBe(true);
    expect(isBusy(fixture, '.chart-profit')).toBe(true);
    expect(isBusy(fixture, '.chart-due-dates')).toBe(true);
  });

  it('load_oneSourceAnswers_clearsOnlyThatCardsPlaceholder', () => {
    const gates = holdDashboardSources({ reports, products, health, dialog, breakpoints });
    render();

    gates.releaseProducts();
    fixture.detectChanges();

    // One flag per request, which is what lets the fast source render while the slow one waits.
    expect(hasSkeleton(fixture, '.kpi-products')).toBe(false);
    expect(textOf(fixture, '.kpi-products .kpi-value').trim()).toBe('42');
    expect(isBusy(fixture, '.kpi-products')).toBe(false);
    expect(hasSkeleton(fixture, '.kpi-overdue')).toBe(true);
  });

  it('load_everySourceAnswers_leavesNoPlaceholderAndRendersEveryFigure', () => {
    const gates = holdDashboardSources({ reports, products, health, dialog, breakpoints });
    render();

    gates.releaseProducts();
    gates.releaseLowStock();
    gates.releaseOverdue();
    gates.releaseProfit();
    gates.releaseDueDates();
    fixture.detectChanges();

    expect(skeletons(fixture)).toEqual([]);
    expect(kpiValues(fixture)).toEqual(['42', '1', '3', '€85.00']);
    // and the charts are back, which is what the chart placeholder was standing in for
    expect(chartHeights(fixture)).toEqual(['15rem', '15rem']);
  });

  it('load_sourceFails_replacesThePlaceholderWithTheDashRatherThanLeavingItSpinning', () => {
    const gates = holdDashboardSources({ reports, products, health, dialog, breakpoints });
    render();
    expect(hasSkeleton(fixture, '.kpi-products')).toBe(true);

    gates.failProducts(new ApiError('Dashboard is unavailable.', 500, undefined, undefined));
    fixture.detectChanges();

    // A placeholder over a request that already lost promises a figure that is never coming.
    expect(hasSkeleton(fixture, '.kpi-products')).toBe(false);
    expect(isBusy(fixture, '.kpi-products')).toBe(false);
    expect(textOf(fixture, '.kpi-products .kpi-value').trim()).toBe('—');
  });

  it('load_answered_showsNoPlaceholderAtAll', () => {
    // The sources answer synchronously here, so this is the ordinary render every other spec sees:
    // the placeholders must be gone by the time the page is first readable.
    render();

    expect(skeletons(fixture)).toEqual([]);
  });

  it('chartHeight_handsetViewport_usesTallerCharts', () => {
    breakpoints.setMatches(false);
    render();

    // Below desktop the rows stack, so the charts trade viewport fit for readability.
    expect(chartHeights(fixture)).toEqual(['20rem', '20rem']);
  });
});
