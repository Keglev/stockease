import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { LANGUAGE_STORAGE_KEY, LanguageService } from './language.service';

class TranslateServiceStub {
  used: string[] = [];
  browserLang: string | undefined = 'en-US';

  use(lang: string) {
    this.used.push(lang);
    return of({});
  }

  getBrowserLang(): string | undefined {
    return this.browserLang;
  }
}

function setUp(browserLang: string | undefined): {
  service: LanguageService;
  translate: TranslateServiceStub;
} {
  const translate = new TranslateServiceStub();
  translate.browserLang = browserLang;

  TestBed.configureTestingModule({
    providers: [{ provide: TranslateService, useValue: translate }]
  });

  return { service: TestBed.inject(LanguageService), translate };
}

describe('LanguageService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('initialize_storedGerman_winsOverBrowserLanguage', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
    const { service, translate } = setUp('en-US');

    service.initialize().subscribe();

    expect(service.currentLang()).toBe('de');
    expect(translate.used).toEqual(['de']);
  });

  it('initialize_germanBrowserWithoutStoredValue_selectsGerman', () => {
    const { service, translate } = setUp('de-DE');

    service.initialize().subscribe();

    expect(service.currentLang()).toBe('de');
    expect(translate.used).toEqual(['de']);
  });

  it('initialize_unsupportedStoredValue_fallsBackToBrowserThenEnglish', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    const { service, translate } = setUp('en-US');

    service.initialize().subscribe();

    expect(service.currentLang()).toBe('en');
    expect(translate.used).toEqual(['en']);
    // The invalid value is replaced rather than left to poison the next startup.
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });

  it('initialize_unsupportedStoredValueWithGermanBrowser_selectsGerman', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    const { service } = setUp('de-DE');

    service.initialize().subscribe();

    expect(service.currentLang()).toBe('de');
  });

  it('setLanguage_supportedValue_persistsAndUpdatesSignal', () => {
    const { service, translate } = setUp('en-US');

    service.setLanguage('de');

    expect(service.currentLang()).toBe('de');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('de');
    expect(translate.used).toEqual(['de']);
  });

  it('setLanguage_unsupportedValue_isIgnored', () => {
    const { service, translate } = setUp('en-US');
    service.setLanguage('de');

    service.setLanguage('fr');

    expect(service.currentLang()).toBe('de');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('de');
    expect(translate.used).toEqual(['de']);
  });
});
