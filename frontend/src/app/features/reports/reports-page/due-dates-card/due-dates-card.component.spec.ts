import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { InvoiceDueSummary } from '../../../../core/api/api-models';
import { LanguageService } from '../../../../core/i18n/language.service';
import { provideFakeChartEngine } from '../../../../testing/chart-testing';
import { provideTestTranslations } from '../../../../testing/i18n-testing';
import { DueDatesCardComponent } from './due-dates-card.component';

const TRANSLATIONS = {
  en: {
    invoices: { type: { PURCHASE: 'Purchase', SALE: 'Sale' } },
    reports: {
      due: {
        chart: 'Outstanding value by due date',
        dueSoon: 'Due soon',
        overdue: 'Overdue',
        daysOverdue: '{{days}} days late',
        empty: 'No invoices are currently outstanding.',
        dueSoonEmpty: 'No invoices fall due in the coming week.',
        overdueEmpty: 'No invoice is overdue.'
      }
    }
  }
};

const DUE_SOON: InvoiceDueSummary[] = [
  {
    invoiceId: 9,
    invoiceNumber: 'RE-2026-0009',
    invoiceType: 'PURCHASE',
    counterparty: 'Acme',
    dueDate: '2026-03-05',
    outstandingValue: 40,
    daysOverdue: null
  }
];

const OVERDUE: InvoiceDueSummary[] = [
  {
    invoiceId: 1,
    invoiceNumber: 'RE-2026-0001',
    invoiceType: 'SALE',
    counterparty: 'Jane Doe',
    dueDate: '2026-02-01',
    outstandingValue: 30,
    daysOverdue: 5
  }
];

/*
 * The due-dates tab's body, as a card: it draws the outstanding-value chart on the option it is
 * given, falls back to the empty state when there is none, and renders the two invoice lists with
 * the late-day chip on the overdue rows that carry a count and the invoice links that label a row
 * by its number while routing on its id.
 * Out of scope: the three queries behind those inputs, when they fire, and the chart derivation -
 * all of which stay with the page and are covered by reports-page.due-dates.spec.ts; and the chart
 * wrapper itself (chart.component.spec.ts).
 * Siblings: period-toggle.component.spec.ts, report-view-toggle.component.spec.ts and
 * supplier-product-picker.component.spec.ts are the reports page's other extracted pieces.
 */
describe('DueDatesCardComponent', () => {
  let fixture: ComponentFixture<DueDatesCardComponent>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /* Renders the card in one of its two halves, with both lists populated by default. */
  async function render(view: 'chart' | 'table', option: unknown = { series: [] }): Promise<void> {
    const ref = fixture.componentRef;
    ref.setInput('view', view);
    ref.setInput('option', option);
    ref.setInput('dueSoonRows', DUE_SOON);
    ref.setInput('overdueRows', OVERDUE);
    await settle();
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [DueDatesCardComponent],
      providers: [provideRouter([]), provideTestTranslations(TRANSLATIONS), provideFakeChartEngine()]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(DueDatesCardComponent);
  });

  it('chartHalf_optionGiven_drawsTheChartRatherThanTheEmptyState', async () => {
    await render('chart');

    expect(host().querySelector('app-chart')).not.toBeNull();
    expect(host().querySelector('.empty-state')).toBeNull();
  });

  it('chartHalf_nullOption_showsTheEmptyStateInsteadOfAnEmptyChart', async () => {
    await render('chart', null);

    expect(host().querySelector('app-chart')).toBeNull();
    expect(host().textContent).toContain('No invoices are currently outstanding.');
  });

  it('listsHalf_rowsGiven_rendersBothListsWithTheirRows', async () => {
    await render('table');

    expect(host().querySelectorAll('.due-soon-row').length).toBe(1);
    expect(host().querySelectorAll('.overdue-row').length).toBe(1);
  });

  it('listsHalf_bothListsEmpty_showsTheirOwnEmptyStates', async () => {
    const ref = fixture.componentRef;
    ref.setInput('view', 'table');
    ref.setInput('option', null);
    ref.setInput('dueSoonRows', []);
    ref.setInput('overdueRows', []);
    await settle();

    // Two separate lists with two separate sentences: "nothing due soon" and "nothing overdue"
    // are different pieces of news.
    expect(host().textContent).toContain('No invoices fall due in the coming week.');
    expect(host().textContent).toContain('No invoice is overdue.');
  });

  it('lateChip_overdueRowWithACount_showsItAndDueSoonRowsDoNot', async () => {
    await render('table');

    // The chip is the count, and only the overdue query computes one.
    expect(host().querySelector('.overdue-row')?.textContent).toContain('5 days late');
    expect(host().querySelector('.due-soon-row .days-overdue')).toBeNull();
  });

  it('lateChip_overdueRowWithoutACount_isOmitted', async () => {
    const ref = fixture.componentRef;
    ref.setInput('view', 'table');
    ref.setInput('option', null);
    ref.setInput('dueSoonRows', []);
    ref.setInput('overdueRows', [{ ...OVERDUE[0], daysOverdue: null }]);
    await settle();

    // With no count there is nothing to show rather than "null days late".
    expect(host().querySelector('.overdue-row .days-overdue')).toBeNull();
  });

  it('invoiceLink_anyRow_labelsByNumberAndRoutesById', async () => {
    await render('table');

    const link = host().querySelector('.overdue-row a');
    expect(link?.getAttribute('href')).toBe('/app/invoices/1');
    expect(link?.textContent?.trim()).toBe('RE-2026-0001');
  });
});
