import { ComponentFixture } from '@angular/core/testing';

import {
  OVERDUE,
  ReportServiceStub,
  configureReportsPageTestBed,
  createReportsPageHelpers
} from './reports-page.fixtures';
import { ReportsPageComponent } from './reports-page.component';

/*
 * The due-dates tab: the outstanding-value chart over the server's buckets, and the two invoice
 * lists behind the toggle - due soon and overdue - including the late-day chip only the overdue
 * query computes and the links that label an invoice by its number while routing on its id.
 *
 * That all three of its queries fire on activation is pinned here; that a failure among them
 * reaches the shared banner is a page-level contract and belongs to the shell spec.
 *
 * Siblings: reports-page.component.spec.ts (shell), and the tab siblings reports-page.profit.spec.ts,
 * reports-page.cash-flow.spec.ts, reports-page.stock.spec.ts, reports-page.losses.spec.ts,
 * reports-page.changes.spec.ts, and reports-page.analytics.spec.ts.
 * Out of scope: the requests (report.service.spec.ts), the chart wrapper
 * (chart.component.spec.ts), the top-N rule (chart-data.spec.ts) and the profit drill-down
 * (profit-detail-dialog.component.spec.ts).
 */
describe('ReportsPageComponent due-dates tab', () => {
  let fixture: ComponentFixture<ReportsPageComponent>;
  let reports: ReportServiceStub;

  const { render, host, activateTab, showTable, optionOf } =
    createReportsPageHelpers(() => fixture, (value) => { fixture = value; });

  beforeEach(() => {
    // Only Date is faked: the period presets compute their bounds from today, and a test reading
    // the real clock would change its expected range every day. Timers stay real.
    vi.useFakeTimers({ toFake: ['Date'] });
    ({ reports } = configureReportsPageTestBed({ open: vi.fn() }, vi.fn()));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('activate_dueTab_loadsAllThreeDueQueries', async () => {
    render();
    await activateTab(4);

    expect(reports.calls).toContain('dueDates');
    expect(reports.calls).toContain('dueSoon');
    expect(reports.calls).toContain('overdue');
  });

  it('dueLists_overdueRows_renderDaysOverdueAndDueSoonRowsDoNot', async () => {
    render();
    await activateTab(4);
    await showTable(4);

    expect(host().querySelector('.overdue-row')?.textContent).toContain('5 days late');
    expect(host().querySelector('.due-soon-row .days-overdue')).toBeNull();
  });

  it('dueLists_anyRow_linksToItsInvoice', async () => {
    render();
    await activateTab(4);
    await showTable(4);

    // The label names the invoice the way an operator does; the href keeps the technical id,
    // which stays the routing key (ADR 022).
    const link = host().querySelector('.overdue-row a');
    expect(link?.getAttribute('href')).toBe('/app/invoices/1');
    expect(link?.textContent?.trim()).toBe('RE-2026-0001');
  });

  it('dueTab_bothListsEmpty_showsTheirOwnEmptyStates', async () => {
    reports.dueSoonPayload = [];
    reports.overduePayload = [];
    render();
    await activateTab(4);
    await showTable(4);

    // Two separate lists with two separate sentences: "nothing due soon" and "nothing overdue"
    // are different pieces of news.
    expect(host().textContent).toContain('No invoices fall due in the coming week.');
    expect(host().textContent).toContain('No invoice is overdue.');
  });

  it('dueChart_noBuckets_rendersEmptyStateInsteadOfAnEmptyChart', async () => {
    reports.buckets = [];
    render();

    await activateTab(4);

    expect(optionOf('dueOption')).toBeNull();
    expect(host().textContent).toContain('No invoices are currently outstanding.');
  });

  it('overdueRow_withoutADayCount_omitsTheLateChip', async () => {
    reports.overduePayload = [{ ...OVERDUE[0], daysOverdue: null }];
    render();
    await activateTab(4);
    await showTable(4);

    // The chip is the count; with no count there is nothing to show rather than "null days late".
    expect(host().querySelector('.overdue-row .days-overdue')).toBeNull();
  });
});
