import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

/**
 * jsdom's matchMedia always reports `matches: false`, so the preference is stubbed
 * on the injected document's defaultView to drive the resolution branches.
 */
function setUp(prefersDark: boolean): ThemeService {
  const realDocument = document;
  const view = {
    matchMedia: (query: string) => ({ matches: prefersDark && query.includes('dark') })
  };
  const documentStub = {
    documentElement: realDocument.documentElement,
    defaultView: view
  };

  TestBed.configureTestingModule({
    providers: [{ provide: DOCUMENT, useValue: documentStub }]
  });

  return TestBed.inject(ThemeService);
}

function appliedScheme(): string {
  return document.documentElement.style.colorScheme;
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.colorScheme = '';
    TestBed.resetTestingModule();
  });

  it('initialize_storedDark_winsOverMediaQuery', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const service = setUp(false);

    service.initialize();

    expect(service.currentTheme()).toBe('dark');
    expect(appliedScheme()).toBe('dark');
  });

  it('initialize_mediaQueryPrefersDark_selectsDark', () => {
    const service = setUp(true);

    service.initialize();

    expect(service.currentTheme()).toBe('dark');
    expect(appliedScheme()).toBe('dark');
  });

  it('initialize_noStoredValueAndNoPreference_fallsBackToLight', () => {
    const service = setUp(false);

    service.initialize();

    expect(service.currentTheme()).toBe('light');
    expect(appliedScheme()).toBe('light');
  });

  it('initialize_invalidStoredValue_fallsBackToMediaQuery', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'solarized');
    const service = setUp(true);

    service.initialize();

    expect(service.currentTheme()).toBe('dark');
    expect(appliedScheme()).toBe('dark');
  });

  it('setTheme_darkMode_persistsUpdatesSignalAndAppliesColorScheme', () => {
    const service = setUp(false);

    service.setTheme('dark');

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(service.currentTheme()).toBe('dark');
    expect(appliedScheme()).toBe('dark');
  });

  it('setTheme_unsupportedValue_isIgnored', () => {
    const service = setUp(false);
    service.setTheme('dark');

    service.setTheme('solarized');

    expect(service.currentTheme()).toBe('dark');
    expect(appliedScheme()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('toggle_lightMode_switchesToDarkAndBack', () => {
    const service = setUp(false);
    service.initialize();
    expect(service.currentTheme()).toBe('light');

    service.toggle();

    expect(service.currentTheme()).toBe('dark');
    expect(appliedScheme()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    service.toggle();

    expect(service.currentTheme()).toBe('light');
    expect(appliedScheme()).toBe('light');
  });
});
