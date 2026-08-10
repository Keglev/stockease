import { ComponentFixture } from '@angular/core/testing';

import {
  AuditServiceStub,
  configureReportsPageTestBed,
  createReportsPageHelpers
} from './reports-page.fixtures';
import { ReportsPageComponent } from './reports-page.component';

/*
 * The changes tab: the audit-trail table, its period presets, the user select whose options come
 * from the loaded rows, the free-text filter, and the export that carries every active narrowing.
 * The one tab with no chart, and the one that reads the audit module rather than the reporting one.
 *
 * That its failure reaches the shared banner is a page-level contract and belongs to the shell
 * spec.
 *
 * Siblings: reports-page.component.spec.ts (shell), and the tab siblings reports-page.profit.spec.ts,
 * reports-page.cash-flow.spec.ts, reports-page.stock.spec.ts, reports-page.losses.spec.ts,
 * reports-page.due-dates.spec.ts, and reports-page.analytics.spec.ts.
 * Out of scope: the requests (report.service.spec.ts), the chart wrapper
 * (chart.component.spec.ts), the top-N rule (chart-data.spec.ts) and the profit drill-down
 * (profit-detail-dialog.component.spec.ts).
 */
describe('ReportsPageComponent changes tab', () => {
  let fixture: ComponentFixture<ReportsPageComponent>;
  let audit: AuditServiceStub;
  let download: ReturnType<typeof vi.fn>;

  const { render, host, activateTab, settle, setFilter, typeFilter } =
    createReportsPageHelpers(() => fixture, (value) => { fixture = value; });

  beforeEach(() => {
    // Only Date is faked: the period presets compute their bounds from today, and a test reading
    // the real clock would change its expected range every day. Timers stay real.
    vi.useFakeTimers({ toFake: ['Date'] });
    download = vi.fn();
    ({ audit } = configureReportsPageTestBed({ open: vi.fn() }, download));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('changesTab_firstActivation_loadsLazily', async () => {
    render();
    expect(audit.calls).toBe(0);

    await activateTab(5);

    // no bounds on the default 'all' window, and only on first activation
    expect(audit.ranges).toEqual([[undefined, undefined]]);
    await activateTab(0);
    await activateTab(5);
    expect(audit.calls).toBe(1);
  });

  it('changesTab_presetChange_refetchesWithComputedRange', async () => {
    vi.setSystemTime(new Date(2026, 2, 15, 12));
    render();
    await activateTab(5);

    await selectChangePeriod('d30');

    expect(audit.ranges.at(-1)).toEqual(['2026-02-13', '2026-03-15']);
  });

  it('changesTab_userSelected_narrowsRowsAndExport', async () => {
    render();
    await activateTab(5);

    await setFilter('setChangeUser', 'markus.weber');

    expect(host().querySelectorAll('.change-table tbody tr').length).toBe(1);
    host().querySelector<HTMLButtonElement>('.export-changes')?.click();

    // the download carries the narrowed view, with the field label translated as the table shows it
    const [filename, content] = download.mock.calls[0] as [string, string];
    expect(filename).toBe('changes.csv');
    expect(content).toContain('markus.weber');
    expect(content).toContain('Purchase price');
    expect(content).not.toContain('julia.brandt');
  });

  it('changesTab_textFilter_matchesNameOrSku', async () => {
    render();
    await activateTab(5);

    await setFilter('setChangeFilter', 'abc-4');

    // matched on SKU, not on the product name, which shares no substring with it
    const rows = host().querySelectorAll('.change-table tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Gadget');
  });

  it('changesFilter_typedIntoTheField_narrowsTheRows', async () => {
    render();
    await activateTab(5);

    await typeFilter('Gadget');

    expect(host().querySelectorAll('.change-row').length).toBe(1);
  });

  it('changesUserSelect_optionChosen_narrowsToThatUser', async () => {
    render();
    await activateTab(5);

    host().querySelector<HTMLElement>('.change-user-select .mat-mdc-select-trigger')?.click();
    await settle();
    document.querySelectorAll<HTMLElement>('mat-option')[1]?.click();
    await settle();

    expect(host().querySelectorAll('.change-row').length).toBe(1);
  });

  it('changesTab_noRows_showsEmptyStateWithNoFilterRow', async () => {
    audit.changePayload = [];
    render();
    await activateTab(5);

    expect(host().querySelector('.report-filter')).toBeNull();
    expect(host().textContent).toContain('No changes in this period.');
  });

  it('changesTab_periodChangedWithTheSelectedUserStillPresent_keepsTheSelection', async () => {
    render();
    await activateTab(5);
    host().querySelector<HTMLElement>('.change-user-select .mat-mdc-select-trigger')?.click();
    await settle();
    document.querySelectorAll<HTMLElement>('mat-option')[1]?.click();
    await settle();

    await selectChangePeriod('d30');

    // The account is still in the narrower window, so the filter must survive the refetch.
    expect(host().querySelectorAll('.change-row').length).toBe(1);
  });

  /* Clicks a changes period preset through the component, the way the toggle group does. */
  async function selectChangePeriod(period: string): Promise<void> {
    const page = fixture.componentInstance as unknown as {
      setChangePeriod: (value: string) => void;
    };
    page.setChangePeriod(period);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
});
