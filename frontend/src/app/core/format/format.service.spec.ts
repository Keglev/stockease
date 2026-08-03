import { TestBed } from '@angular/core/testing';

import { LanguageService } from '../i18n/language.service';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { FORMAT_DATE_KEY, FORMAT_NUMBER_KEY, FormatService } from './format.service';

/** The last day of 2026 at 15:04, which reads differently in every option this service offers. */
const MOMENT = new Date(2026, 11, 31, 15, 4);

describe('FormatService', () => {
  let format: FormatService;
  let language: LanguageService;

  /**
   * Intl separates a currency symbol with a no-break space, and which one it uses varies by ICU
   * version - U+00A0 in some builds, U+202F in others. Compared on code points rather than with
   * an escape in a regex literal, so these assertions stay about the format itself.
   */
  const SPACES = new Set([0x20, 0xa0, 0x202f]);

  function plain(value: string): string {
    return [...value].map((ch) => (SPACES.has(ch.codePointAt(0) ?? 0) ? " " : ch)).join("");
  }

  function setUp(): void {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideTestTranslations({ en: {}, de: {} })] });
    language = TestBed.inject(LanguageService);
    language.initialize().subscribe();
    format = TestBed.inject(FormatService);
  }

  beforeEach(() => setUp());

  it('formatDate_autoAndGerman_rendersDayFirstWithDots', () => {
    language.setLanguage('de');

    expect(format.formatDate(MOMENT)).toBe('31.12.2026');
  });

  it('formatDate_autoAndEnglish_rendersMonthFirstWithSlashes', () => {
    language.setLanguage('en');

    expect(format.formatDate(MOMENT)).toBe('12/31/2026');
  });

  it('formatCurrency_autoAndGerman_rendersCommaDecimalAndTrailingSymbol', () => {
    language.setLanguage('de');

    // 1.234,56 € - the mark the whole defect was about; en-US rendered €1,234.56 in German.
    expect(plain(format.formatCurrency(1234.56))).toBe('1.234,56 €');
  });

  it('formatCurrency_autoAndEnglish_rendersDotDecimalAndLeadingSymbol', () => {
    language.setLanguage('en');

    expect(plain(format.formatCurrency(1234.56))).toBe('€1,234.56');
  });

  it('formatDate_explicitOverride_beatsTheLanguage', () => {
    language.setLanguage('de');

    format.setDateFormat('ymdDash');

    // The override pins the order and separator; the language no longer decides them.
    expect(format.formatDate(MOMENT)).toBe('2026-12-31');
  });

  it('formatCurrency_dateOverrideOnly_staysOnTheLanguagesNumbers', () => {
    language.setLanguage('de');
    format.setDateFormat('ymdDash');

    // Asking for ISO dates says nothing about wanting a dot as a decimal mark.
    expect(plain(format.formatCurrency(1234.56))).toBe('1.234,56 €');
  });

  it('formatCurrency_numberOverride_beatsTheLanguage', () => {
    language.setLanguage('en');

    format.setNumberFormat('de');

    expect(plain(format.formatCurrency(1234.56))).toBe('1.234,56 €');
    expect(format.numberLocale()).toBe('de-DE');
  });

  it('formatDate_languageChangedWhileAuto_followsTheNewLanguage', () => {
    language.setLanguage('en');
    expect(format.formatDate(MOMENT)).toBe('12/31/2026');

    language.setLanguage('de');

    expect(format.formatDate(MOMENT)).toBe('31.12.2026');
  });

  it('formatDate_languageChangedWhileOverridden_keepsTheOverride', () => {
    format.setDateFormat('mdySlash');
    language.setLanguage('de');

    // An explicit choice is not undone by a language switch.
    expect(format.formatDate(MOMENT)).toBe('12/31/2026');
  });

  it('formatDateTime_german_appendsTwentyFourHourTime', () => {
    language.setLanguage('de');

    expect(format.formatDateTime(MOMENT)).toBe('31.12.2026 15:04');
  });

  it('formatDateTime_english_appendsTwelveHourTime', () => {
    language.setLanguage('en');

    expect(plain(format.formatDateTime(MOMENT))).toBe('12/31/2026 03:04 PM');
  });

  it.each([null, undefined, '', 'not a date'])('formatDate_%s_rendersNothing', (value) => {
    // Rather than "Invalid Date" in a table cell.
    expect(format.formatDate(value as string | null)).toBe('');
  });

  it.each([null, undefined])('formatCurrency_%s_rendersNothing', (value) => {
    expect(format.formatCurrency(value)).toBe('');
  });

  it('setDateFormat_unsupportedValue_keepsThePreviousChoice', () => {
    format.setDateFormat('ymdDash');

    format.setDateFormat('klingon');

    expect(format.dateFormat()).toBe('ymdDash');
  });

  it('setFormats_anyChoice_persistsForTheNextVisit', () => {
    format.setDateFormat('dmyDot');
    format.setNumberFormat('en');

    expect(localStorage.getItem(FORMAT_DATE_KEY)).toBe('dmyDot');
    expect(localStorage.getItem(FORMAT_NUMBER_KEY)).toBe('en');
  });

  it('construct_storedChoices_areReadBackOnStartup', () => {
    localStorage.setItem(FORMAT_DATE_KEY, 'ymdDash');
    localStorage.setItem(FORMAT_NUMBER_KEY, 'de');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideTestTranslations({ en: {}, de: {} })] });

    const restored = TestBed.inject(FormatService);

    expect(restored.dateFormat()).toBe('ymdDash');
    expect(restored.numberFormat()).toBe('de');
  });
});
