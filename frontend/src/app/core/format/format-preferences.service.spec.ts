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
 * back when the service is constructed.
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
});
