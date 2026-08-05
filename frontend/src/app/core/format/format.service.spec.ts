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

  it('formatNumber_autoAndGerman_groupsWithDotsAndDecimalsWithAComma', () => {
    language.setLanguage('de');

    // The confusion this method exists to prevent: 1,234 in German is one and a bit, not a thousand.
    expect(format.formatNumber(1234.5)).toBe('1.234,5');
  });

  it('formatNumber_autoAndEnglish_groupsWithCommas', () => {
    language.setLanguage('en');

    expect(format.formatNumber(1234.5)).toBe('1,234.5');
  });

  it('formatNumber_anyLocale_carriesNoCurrencySymbol', () => {
    language.setLanguage('de');

    // A count is not money; the whole reason this sits beside formatCurrency rather than in it.
    expect(format.formatNumber(1234.5)).not.toContain('€');
  });

  it('formatNumber_numberOverride_beatsTheLanguage', () => {
    language.setLanguage('en');

    format.setNumberFormat('de');

    expect(format.formatNumber(1234.5)).toBe('1.234,5');
  });

  it('formatNumber_repeatedCalls_renderIdenticallyThroughTheCachedFormatter', () => {
    language.setLanguage('de');
    const first = format.formatNumber(1234.5);

    language.setLanguage('en');
    format.formatNumber(1234.5);
    language.setLanguage('de');

    // The formatter is cached per locale and reused; a cache keyed wrongly would hand the second
    // German call the English one it built in between.
    expect(format.formatNumber(1234.5)).toBe(first);
  });

  it.each([null, undefined, 'not a number'])('formatNumber_%s_rendersNothing', (value) => {
    expect(format.formatNumber(value as string | null)).toBe('');
  });

  it('formatMonth_germanAndEnglish_readTheMonthInEachLanguagesOwnWords', () => {
    language.setLanguage('de');
    expect(format.formatMonth('2026-01')).toBe('Jan. 2026');

    language.setLanguage('en');
    expect(format.formatMonth('2026-01')).toBe('Jan 2026');
  });

  // No spec pins the month against the UTC-parse trap the implementation avoids: the suite runs in
  // Europe/Berlin, where `new Date('2026-01')` lands at 01:00 on the 1st and is still January. A
  // test asserting it would pass either way here and fail only on a machine west of Greenwich,
  // which is a worse outcome than the comment in formatMonth explaining the regex.

  it.each(['', 'nonsense', '2026-1'])('formatMonth_%s_rendersTheKeyItself', (value) => {
    // An axis tick that vanishes is worse than one showing the raw key it was built from.
    expect(format.formatMonth(value)).toBe(value);
  });

  it.each([null, undefined])('formatMonth_%s_rendersNothing', (value) => {
    // There is no key to fall back on here, so this is the one case that renders as nothing.
    expect(format.formatMonth(value)).toBe('');
  });

  it('formatPercent_germanAndEnglish_useEachLocalesDecimalMarkAndSpacing', () => {
    language.setLanguage('de');
    expect(plain(format.formatPercent(42.5))).toBe('42,5 %');

    language.setLanguage('en');
    expect(plain(format.formatPercent(42.5))).toBe('42.5%');
  });

  it('formatPercent_valueOutOfOneHundred_isNotMultipliedAgain', () => {
    language.setLanguage('en');

    // Intl's percent style takes a fraction; the gauge hands over the number on its own 0-100 dial.
    expect(plain(format.formatPercent(42.5))).toBe('42.5%');
    expect(plain(format.formatPercent(100))).toBe('100%');
  });

  it.each([null, undefined])('formatPercent_%s_rendersNothing', (value) => {
    expect(format.formatPercent(value)).toBe('');
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
