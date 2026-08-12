import { TestBed } from '@angular/core/testing';

import { LanguageService } from '../i18n/language.service';
import { provideTestTranslations } from '../../testing/i18n-testing';
import {
  FORMAT_DATE_KEY,
  FORMAT_NUMBER_KEY,
  FormatPreferencesService
} from './format-preferences.service';

/*
 * The two stored formatting preferences: their defaults, that an unsupported value is ignored
 * rather than applied, that a choice persists for the next visit, and that a stored choice is read
 * back when the service is constructed. Also the locale those preferences resolve to, which every
 * renderer reads: which language maps to which locale, that an explicit preference beats the
 * language, and which of the two a language change moves.
 * Out of scope: everything rendered from these preferences - format.service.spec.ts.
 */
describe('FormatPreferencesService', () => {
  let format: FormatPreferencesService;
  let language: LanguageService;

  function setUp(): void {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideTestTranslations({ en: {}, de: {} })] });
    language = TestBed.inject(LanguageService);
    language.initialize().subscribe();
    format = TestBed.inject(FormatPreferencesService);
  }

  beforeEach(() => setUp());

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

    const restored = TestBed.inject(FormatPreferencesService);

    expect(restored.dateFormat()).toBe('ymdDash');
    expect(restored.numberFormat()).toBe('de');
  });

  it('numberLocale_autoInBothLanguages_followsTheInterfaceLanguage', () => {
    // Both directions rather than one example: a mapping pinned by a single language would still
    // pass if every language resolved to that one locale.
    language.setLanguage('de');
    expect(format.numberLocale()).toBe('de-DE');

    language.setLanguage('en');
    expect(format.numberLocale()).toBe('en-US');
  });

  it('numberLocale_explicitPreference_beatsTheLanguageInBothDirections', () => {
    // The branch the settings page exists for, asserted where the two disagree - agreeing values
    // would be satisfied by an implementation that ignored the preference entirely.
    language.setLanguage('en');
    format.setNumberFormat('de');
    expect(format.numberLocale()).toBe('de-DE');

    setUp();
    language.setLanguage('de');
    format.setNumberFormat('en');
    expect(format.numberLocale()).toBe('en-US');
  });

  it('numberLocale_languageChangedWhileAuto_reDerives', () => {
    language.setLanguage('en');
    expect(format.numberLocale()).toBe('en-US');

    language.setLanguage('de');

    // The property is the computed re-deriving, not the value it happened to start on.
    expect(format.numberLocale()).toBe('de-DE');
  });

  it('numberLocale_languageChangedWhileOverridden_staysOnThePreference', () => {
    language.setLanguage('en');
    format.setNumberFormat('de');

    language.setLanguage('de');

    // An explicit choice is not undone by a language switch, and switching TO the preference's own
    // language must not be what makes this pass: it is read again after moving away from it.
    expect(format.numberLocale()).toBe('de-DE');
    language.setLanguage('en');
    expect(format.numberLocale()).toBe('de-DE');
  });
});
