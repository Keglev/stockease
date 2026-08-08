import { TestBed } from '@angular/core/testing';

import { FormatService } from '../../core/format/format.service';
import { LanguageService } from '../../core/i18n/language.service';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { AppCurrencyPipe } from './app-currency.pipe';
import { AppDateTimePipe } from './app-date-time.pipe';
import { AppDatePipe } from './app-date.pipe';

const MOMENT = new Date(2026, 11, 31, 15, 4);

/*
 * The pipes carry no logic of their own; these pin that they delegate to the service and survive
 * a null, which is the only thing a template can hand them that the service must not choke on.
 */
describe('format pipes', () => {
  let format: FormatService;
  let language: LanguageService;

  /*
   * Intl separates a currency symbol with a no-break space, and which one it uses varies by ICU
   * version - U+00A0 in some builds, U+202F in others. Compared on code points rather than with
   * an escape in a regex literal, so these assertions stay about the format itself.
   */
  const SPACES = new Set([0x20, 0xa0, 0x202f]);

  function plain(value: string): string {
    return [...value].map((ch) => (SPACES.has(ch.codePointAt(0) ?? 0) ? " " : ch)).join("");
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideTestTranslations({ en: {}, de: {} })] });
    language = TestBed.inject(LanguageService);
    language.initialize().subscribe();
    format = TestBed.inject(FormatService);
  });

  function pipes(): { date: AppDatePipe; dateTime: AppDateTimePipe; currency: AppCurrencyPipe } {
    return TestBed.runInInjectionContext(() => ({
      date: new AppDatePipe(),
      dateTime: new AppDateTimePipe(),
      currency: new AppCurrencyPipe()
    }));
  }

  it('appDate_value_matchesTheServiceOutput', () => {
    language.setLanguage('de');

    expect(pipes().date.transform(MOMENT)).toBe(format.formatDate(MOMENT));
    expect(pipes().date.transform(MOMENT)).toBe('31.12.2026');
  });

  it('appDateTime_value_matchesTheServiceOutput', () => {
    language.setLanguage('de');

    expect(pipes().dateTime.transform(MOMENT)).toBe(format.formatDateTime(MOMENT));
  });

  it('appCurrency_value_matchesTheServiceOutput', () => {
    language.setLanguage('de');

    expect(plain(pipes().currency.transform(1234.56))).toBe('1.234,56 €');
  });

  it.each([null, undefined])('appDate_%s_rendersEmpty', (value) => {
    expect(pipes().date.transform(value)).toBe('');
  });

  it.each([null, undefined])('appDateTime_%s_rendersEmpty', (value) => {
    expect(pipes().dateTime.transform(value)).toBe('');
  });

  it.each([null, undefined])('appCurrency_%s_rendersEmpty', (value) => {
    expect(pipes().currency.transform(value)).toBe('');
  });

  it('appCurrency_afterOverride_reflectsItWithoutANewInput', () => {
    language.setLanguage('en');
    const pipe = pipes().currency;
    expect(plain(pipe.transform(1234.56))).toBe('€1,234.56');

    format.setNumberFormat('de');

    // The pipe is impure precisely so the same input renders differently once the choice changes.
    expect(plain(pipe.transform(1234.56))).toBe('1.234,56 €');
  });
});
