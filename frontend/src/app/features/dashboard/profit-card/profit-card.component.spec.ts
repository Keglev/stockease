import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LanguageService } from '../../../core/i18n/language.service';
import { DashboardComponent } from '../dashboard.component';
import {
  configureDashboardTestBed,
  host,
  MANY_PROFIT,
  ReportServiceStub,
  showProfitTable
} from '../dashboard.fixtures';

/*
 * The profit-by-product card: its table half plots the same slices its chart does, the aggregated
 * remainder is rebuilt rather than frozen when the reader switches language or the data is refreshed,
 * and the two halves never share the card's height.
 *
 * The card is driven through the real dashboard host rather than in isolation, because the host is what
 * loads the profit rows and what refreshes them, and the remainder label is resolved through services
 * the host provides. An isolated harness with inputs set by hand would assert against a wiring this spec
 * invented, not the one that ships.
 * Out of scope: the shell's own KPIs and refresh button (dashboard.component.spec.ts) and the due card
 * (due-card.component.spec.ts), which owns the chart-figure assertions for both cards.
 */
describe('ProfitCardComponent (through the dashboard host)', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let reports: ReportServiceStub;

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
    ({ reports } = configureDashboardTestBed());
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('profitCard_tableView_rendersSameSlicesAsChart', () => {
    reports.profitPayload = MANY_PROFIT;
    render();
    expect(host(fixture).querySelector('.slice-table')).toBeNull();

    showProfitTable(fixture);

    // ten products plus the aggregated remainder, the exact slices the chart plots
    const rows = host(fixture).querySelectorAll('.slice-row');
    expect(rows.length).toBe(11);
    expect(host(fixture).querySelector('.slice-table')?.textContent).toContain('Other');
  });

  it('profitCard_languageSwitched_rebuildsTheRemainderLabel', async () => {
    reports.profitPayload = MANY_PROFIT;
    render();
    showProfitTable(fixture);
    expect(host(fixture).querySelector('.slice-table')?.textContent).toContain('Other');

    TestBed.inject(LanguageService).setLanguage('de');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // The regression this slice fixes: the remainder bucket's name was resolved when the data
    // landed and frozen into the slices, so a reader who switched language kept the English word
    // until something refetched. Nothing refetches here - only the language changed.
    expect(host(fixture).querySelector('.slice-table')?.textContent).toContain('Sonstige');
    expect(host(fixture).querySelector('.slice-table')?.textContent).not.toContain('Other');
  });

  it('profitCard_dataRefreshed_stillRebuildsTheSlices', () => {
    render();
    showProfitTable(fixture);
    expect(host(fixture).querySelector('.slice-table')?.textContent).toContain('Widget');

    // The behaviour the imperative version had, pinned: making the options derived must not cost
    // the rebuild that a refresh already triggered.
    reports.profitPayload = [
      { productId: 9, name: 'Sprocket', sku: 'SKU-9', deleted: false, revenue: 10, cost: 4, grossProfit: 6 }
    ];
    host(fixture).querySelector<HTMLButtonElement>('.dashboard-refresh')?.click();
    fixture.detectChanges();

    expect(host(fixture).querySelector('.slice-table')?.textContent).toContain('Sprocket');
    expect(host(fixture).querySelector('.slice-table')?.textContent).not.toContain('Widget');
  });

  it('profitCard_tableView_replacesTheChart', () => {
    render();

    showProfitTable(fixture);

    // the two halves never share the card's height, as on the reports page
    expect(host(fixture).querySelector('.chart-profit app-chart')).toBeNull();
  });
});
