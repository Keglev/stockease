import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormatService } from '../../../core/format/format.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { DashboardComponent } from '../dashboard.component';
import {
  configureDashboardTestBed,
  dueCard,
  FormatProbe,
  host,
  profitCard,
  ReportServiceStub,
  showDueChart,
  showDueList
} from '../dashboard.fixtures';

/*
 * The upcoming-due-dates card: it opens on its chart and fetches the due rows only when a reader
 * actually opens the list, it caps and links those rows, and the figures inside its chart follow the
 * reader's language and format overrides.
 *
 * The card is driven through the real dashboard host rather than in isolation, because that host owns
 * what this card is for: the lazy fetch, the refresh, and the format services the chart reads. An
 * isolated harness with inputs set by hand would assert against a wiring this spec invented, not the
 * one that ships.
 * Out of scope: the shell's own KPIs and refresh button (dashboard.component.spec.ts) and the profit
 * card (profit-card.component.spec.ts) - the one profit assertion below rides along because it is the
 * same locale switch, read on the other card.
 */
describe('DueCardComponent (through the dashboard host)', () => {
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

  it('dueCard_chartDefault_doesNotFetchDueSoon', () => {
    render();

    // the card opens on the chart, and its buckets are a different request entirely
    expect(reports.dueSoonRequests).toBe(0);
    expect(host(fixture).querySelector('.due-soon-row')).toBeNull();
  });

  it('dueCard_firstListActivation_fetchesOnceAndRendersLinkedRows', () => {
    render();

    showDueList(fixture);

    expect(reports.dueSoonRequests).toBe(1);
    // nine rows come back, eight are shown; the rest live behind the reports link
    const rows = host(fixture).querySelectorAll('.due-soon-row');
    expect(rows.length).toBe(8);
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/app/invoices/1');
  });

  it('dueCard_listView_linksOnToTheReportsPage', () => {
    render();

    showDueList(fixture);

    expect(host(fixture).querySelector('.due-view-all')?.getAttribute('href')).toBe('/app/reports');
  });

  it('dueCard_switchBackAndForth_doesNotRefetch', () => {
    render();
    showDueList(fixture);

    showDueChart(fixture);
    showDueList(fixture);

    // toggling is not a reason to re-query; the refresh button is what re-reads them
    expect(reports.dueSoonRequests).toBe(1);
  });

  /*
   * The figures inside the two cards' charts, asserted by invoking the callbacks the options hand
   * ECharts. The fake engine paints nothing, and a formatter is a function rather than a rendered
   * string, so calling it is the only reading available - and the honest one, since it is exactly
   * what echarts does with it.
   */
  describe('chart values', () => {
    // Both preferences persist to storage, and the specs in a Vitest worker share their origin.
    afterEach(() => localStorage.clear());

    const SPACES = new Set([0x20, 0xa0, 0x202f]);

    function plain(value: string): string {
      return [...value].map((ch) => (SPACES.has(ch.codePointAt(0) ?? 0) ? ' ' : ch)).join('');
    }

    function setFormats(lang: 'en' | 'de', numbers: 'auto' | 'en' | 'de'): void {
      TestBed.inject(LanguageService).setLanguage(lang);
      TestBed.inject(FormatService).setNumberFormat(numbers);
      fixture.detectChanges();
    }

    function optionOf(name: string): FormatProbe {
      return name === 'profitOption' ? profitCard(fixture).profitOption() : dueCard(fixture).dueDateOption();
    }

    it('dueCard_germanInterfaceOnAuto_readsMoneyAndDatesTheGermanWay', () => {
      render();

      setFormats('de', 'auto');

      expect(plain(optionOf('dueDateOption').tooltip?.valueFormatter?.(1234.56) ?? '')).toBe('1.234,56 €');
      expect(optionOf('dueDateOption').xAxis?.axisLabel?.formatter?.('2026-03-01')).toBe('01.03.2026');
      expect(plain(optionOf('profitOption').tooltip?.valueFormatter?.(1234.56) ?? '')).toBe('1.234,56 €');

      // The value axis on each card. The profit bars lie on their side, so theirs is x.
      expect(plain(optionOf('profitOption').xAxis?.axisLabel?.formatter?.(1234.56) ?? '')).toBe('1.234,56 €');
      expect(plain(optionOf('dueDateOption').yAxis?.axisLabel?.formatter?.(1234.56) ?? '')).toBe('1.234,56 €');
    });

    it('dueCard_englishInterfaceOnAuto_readsMoneyAndDatesTheEnglishWay', () => {
      render();

      setFormats('en', 'auto');

      expect(plain(optionOf('dueDateOption').tooltip?.valueFormatter?.(1234.56) ?? '')).toBe('€1,234.56');
      expect(optionOf('dueDateOption').xAxis?.axisLabel?.formatter?.('2026-03-01')).toBe('03/01/2026');
    });

    it('dueCard_germanInterfaceWithEnglishNumbers_followsTheOverride', () => {
      render();

      setFormats('de', 'en');

      // The interface stays German; every figure in it is English, because the reader said so.
      expect(plain(optionOf('dueDateOption').tooltip?.valueFormatter?.(1234.56) ?? '')).toBe('€1,234.56');
    });

    it('dueCard_axisData_staysTheRawIsoKeys', () => {
      render();

      // The series are indexed by these keys and sorted on them; only the labels are formatted.
      expect(optionOf('dueDateOption').xAxis?.data).toEqual(['2026-03-01']);
    });

    it('dueCard_numberFormatSwitchedMidSpec_rebuildsInTheOtherLocale', () => {
      render();
      setFormats('de', 'auto');
      const before = optionOf('dueDateOption');
      expect(plain(before.tooltip?.valueFormatter?.(1234.56) ?? '')).toBe('1.234,56 €');

      TestBed.inject(FormatService).setNumberFormat('en');
      fixture.detectChanges();

      // Nothing refetched; only the preference changed. The identity is the load-bearing half:
      // a formatter closes over the SERVICE, so the old option's callback would already answer in
      // English if anything called it - and nothing does, because echarts is only handed an option
      // when this derivation re-runs. See the reports page's own spec for the measurement.
      const after = optionOf('dueDateOption');
      expect(after).not.toBe(before);
      expect(plain(after.tooltip?.valueFormatter?.(1234.56) ?? '')).toBe('€1,234.56');
    });
  });
});
