import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonToggle } from '@angular/material/button-toggle';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { By } from '@angular/platform-browser';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { routes } from '../../app.routes';
import { AuthService, TOKEN_STORAGE_KEY } from '../../core/auth/auth.service';
import { FormatService } from '../../core/format/format.service';
import { HealthProbe, HealthService } from '../../core/health/health.service';
import { LANGUAGE_STORAGE_KEY, LanguageService } from '../../core/i18n/language.service';
import { ThemeService } from '../../core/theme/theme.service';
import { BreakpointObserverStub } from '../../testing/breakpoint-testing';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { SettingsComponent } from './settings.component';

const TRANSLATIONS = {
  en: {
    common: { language: 'Language', themeLight: 'Light mode', themeDark: 'Dark mode' },
    shell: { role: { ADMIN: 'Administrator', USER: 'User' } },
    settings: {
      title: 'Settings',
      appearance: { title: 'Appearance' },
      language: { en: 'English', de: 'Deutsch' },
      session: {
        title: 'Session',
        username: 'Username',
        role: 'Role',
        loginTime: 'Signed in since',
        idleNote: 'You will be signed out automatically after 30 minutes of inactivity.'
      },
      formats: {
        title: 'Formats',
        auto: 'Automatic (follows language)',
        date: 'Date format',
        number: 'Numbers & currency'
      }
    }
  },
  de: {
    common: { language: 'Sprache', themeLight: 'Helles Design', themeDark: 'Dunkles Design' },
    shell: { role: { ADMIN: 'Administrator', USER: 'Benutzer' } },
    settings: {
      title: 'Einstellungen',
      appearance: { title: 'Darstellung' },
      language: { en: 'English', de: 'Deutsch' },
      session: {
        title: 'Sitzung',
        username: 'Benutzername',
        role: 'Rolle',
        loginTime: 'Angemeldet seit',
        idleNote: 'Nach 30 Minuten Inaktivität werden Sie automatisch abgemeldet.'
      },
      formats: {
        title: 'Formate',
        auto: 'Automatisch (folgt der Sprache)',
        date: 'Datumsformat',
        number: 'Zahlen & Währung'
      }
    }
  }
};

/*
 * The preferences page owns no state: every control reads its service and writes back through it, and
 * the date and number options label themselves with a live example. Also the session facts, which show
 * em dashes rather than blanks when a claim is missing.
 * Out of scope: what the services do with those choices - theme.service, language.service and
 * format.service specs.
 */
describe('SettingsComponent', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let theme: ThemeService;
  let language: LanguageService;

  /* The token facts the Session section displays; the page only reads them. */
  interface Session {
    username: string | null;
    role: 'ADMIN' | 'USER' | null;
    loginTime: Date | null;
  }

  const SIGNED_IN: Session = { username: 'alice', role: 'ADMIN', loginTime: new Date(2026, 11, 31, 15, 4) };

  async function setUp(session: Session = SIGNED_IN): Promise<void> {
    localStorage.clear();
    // Pinned, because the Session row renders a timestamp: without it the expected format would
    // depend on the browser language and so on spec file order.
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            username: signal(session.username),
            role: signal(session.role),
            loginTime: signal(session.loginTime)
          }
        },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        provideTestTranslations(TRANSLATIONS)
      ]
    }).compileComponents();

    theme = TestBed.inject(ThemeService);
    language = TestBed.inject(LanguageService);
    language.initialize().subscribe();
    theme.initialize();

    fixture = TestBed.createComponent(SettingsComponent);
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /*
   * The toggles of one group, as directive instances.
   *
   * <p>Queried through the debug element rather than by CSS: `value` is an input, so it never
   * reaches the DOM as an attribute and an attribute selector would silently match nothing.
   */
  function toggles(group: string): MatButtonToggle[] {
    return fixture.debugElement
      .query(By.css(`.${group}`))
      .queryAll(By.directive(MatButtonToggle))
      .map((debugEl) => debugEl.componentInstance as MatButtonToggle);
  }

  function option(group: string, value: string): MatButtonToggle | undefined {
    return toggles(group).find((toggle) => toggle.value === value);
  }

  /* Clicks a toggle the way a user does, through its rendered button. */
  function choose(group: string, value: string): void {
    const toggle = option(group, value);
    (toggle?._buttonElement.nativeElement as HTMLButtonElement | undefined)?.click();
  }

  function selected(group: string): string[] {
    return toggles(group)
      .filter((toggle) => toggle.checked)
      .map((toggle) => String(toggle.value));
  }

  function labelOf(group: string, value: string): string {
    return option(group, value)?._buttonElement.nativeElement.textContent?.trim() ?? '';
  }

  /* Host carrying the outlet, so the route assertion observes the real table's rendering. */
  @Component({ selector: 'app-test-host', imports: [RouterOutlet], template: '<router-outlet />' })
  class TestHostComponent {}

  /* Unsigned JWT-shaped token, so the /app guard admits the navigation. */
  function validToken(): string {
    const encode = (value: object) =>
      btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const payload = { sub: 'alice', role: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 3600 };
    return `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`;
  }

  /* Navigates the real route table into the shell and returns the rendered host. */
  async function renderRoute(url: string): Promise<HTMLElement> {
    localStorage.clear();
    localStorage.setItem(TOKEN_STORAGE_KEY, validToken());
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        provideRouter(routes),
        provideTestTranslations(TRANSLATIONS),
        { provide: BreakpointObserver, useValue: new BreakpointObserverStub(true) },
        { provide: HealthService, useValue: { check: () => of<HealthProbe>({ up: true, latencyMs: 12 }) } }
      ]
    });
    TestBed.inject(LanguageService).initialize().subscribe();

    const routed = TestBed.createComponent(TestHostComponent);
    routed.detectChanges();
    await TestBed.inject(Router).navigateByUrl(url);
    routed.detectChanges();
    await routed.whenStable();
    routed.detectChanges();
    return routed.nativeElement as HTMLElement;
  }

  it('render_default_showsBothSections', async () => {
    await setUp();

    expect(host().textContent).toContain('Appearance');
    expect(host().textContent).toContain('Language');
    expect(host().querySelectorAll('.settings-theme mat-button-toggle')).toHaveLength(2);
    expect(host().querySelectorAll('.settings-language mat-button-toggle')).toHaveLength(2);
  });

  it('render_currentServiceState_preselectsBothControls', async () => {
    await setUp();
    theme.setTheme('dark');
    language.setLanguage('de');
    await settle();

    // Read off the services rather than held locally, so the toolbar can move them and this agrees.
    expect(selected('settings-theme')).toEqual(['dark']);
    expect(selected('settings-language')).toEqual(['de']);
  });

  it('selectDark_clicked_callsThroughToThemeService', async () => {
    await setUp();
    theme.setTheme('light');
    await settle();

    choose('settings-theme', 'dark');
    await settle();

    expect(theme.currentTheme()).toBe('dark');
    expect(localStorage.getItem('stockease.theme')).toBe('dark');
  });

  it('selectLight_afterDark_callsThroughToThemeService', async () => {
    await setUp();
    theme.setTheme('dark');
    await settle();

    choose('settings-theme', 'light');
    await settle();

    expect(theme.currentTheme()).toBe('light');
  });

  it('selectGerman_clicked_callsThroughToLanguageService', async () => {
    await setUp();

    choose('settings-language', 'de');
    await settle();

    expect(language.currentLang()).toBe('de');
    expect(localStorage.getItem('stockease.lang')).toBe('de');
  });

  it('selectGerman_clicked_retranslatesThePageInPlace', async () => {
    await setUp();

    choose('settings-language', 'de');
    await settle();

    // The same service the toolbar toggle uses, so the whole page follows without a reload.
    expect(host().textContent).toContain('Darstellung');
  });

  it('render_languageOptions_useEachLanguagesOwnName', async () => {
    await setUp();

    // Identical in both files on purpose: a reader stranded in the wrong language can still find
    // their own, which is the one label that must not be translated.
    expect(labelOf('settings-language', 'en')).toBe('English');
    expect(labelOf('settings-language', 'de')).toBe('Deutsch');
  });

  /* The options of one select, opened so the overlay renders them. */
  function selectOptions(cssClass: string): HTMLElement[] {
    const trigger = host().querySelector<HTMLElement>(`.${cssClass} .mat-mdc-select-trigger`);
    trigger?.click();
    fixture.detectChanges();
    return Array.from(document.querySelectorAll<HTMLElement>('mat-option'));
  }

  it('render_default_showsTheFormatsSection', async () => {
    await setUp();

    expect(host().textContent).toContain('Formats');
    expect(host().querySelector('.settings-date-format')).not.toBeNull();
    expect(host().querySelector('.settings-number-format')).not.toBeNull();
  });

  it('render_dateOptions_labelEachChoiceWithALiveExample', async () => {
    await setUp();

    const labels = selectOptions('settings-date-format').map((o) => o.textContent?.trim() ?? '');

    // Automatic is worded; the rest show today's date, which needs no translation.
    expect(labels[0]).toBe('Automatic (follows language)');
    expect(labels[1]).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    expect(labels[3]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('selectDateFormat_chosen_writesThroughToFormatService', async () => {
    await setUp();

    selectOptions('settings-date-format')[3].click();
    await settle();

    expect(TestBed.inject(FormatService).dateFormat()).toBe('ymdDash');
  });

  it('selectNumberFormat_chosen_writesThroughToFormatService', async () => {
    await setUp();

    selectOptions('settings-number-format')[1].click();
    await settle();

    expect(TestBed.inject(FormatService).numberFormat()).toBe('de');
    expect(TestBed.inject(FormatService).numberLocale()).toBe('de-DE');
  });

  it('render_storedFormats_initialiseBothSelects', async () => {
    await setUp();
    const format = TestBed.inject(FormatService);
    format.setDateFormat('mdySlash');
    format.setNumberFormat('en');
    await settle();

    expect(host().querySelector('.settings-date-format .mat-mdc-select-value')?.textContent)
      .toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(host().querySelector('.settings-number-format .mat-mdc-select-value')?.textContent)
      .toContain('1,234.56');
  });

  it('render_signedInSession_showsUsernameRoleAndFormattedTime', async () => {
    await setUp({ username: 'alice', role: 'ADMIN', loginTime: new Date(2026, 11, 31, 15, 4) });

    expect(host().querySelector('.settings-username')?.textContent?.trim()).toBe('alice');
    expect(host().querySelector('.settings-role')?.textContent?.trim()).toBe('Administrator');
    // Through the same pipe the rest of the app uses, so it follows language and format overrides.
    expect(host().querySelector('.settings-login-time')?.textContent?.trim()).toBe('12/31/2026 03:04 PM');
  });

  it('render_missingSessionClaims_showsEmDashesNotBlanks', async () => {
    await setUp({ username: null, role: null, loginTime: null });

    // A blank cell reads as a rendering fault; the dash says the value is genuinely absent.
    expect(host().querySelector('.settings-username')?.textContent?.trim()).toBe('—');
    expect(host().querySelector('.settings-role')?.textContent?.trim()).toBe('—');
    expect(host().querySelector('.settings-login-time')?.textContent?.trim()).toBe('—');
  });

  it('render_sessionSection_carriesTheIdleNote', async () => {
    await setUp();

    expect(host().querySelector('.settings-idle-note')?.textContent).toContain('30 minutes');
  });

  it('route_appSettings_resolvesInsideTheShell', async () => {
    const host = await renderRoute('/app/settings');

    // The real route table, so the guard, the lazy load and the shell nesting are all exercised.
    expect(TestBed.inject(Router).url).toBe('/app/settings');
    expect(host.querySelector('app-shell app-settings')).not.toBeNull();
    expect(host.querySelector('.settings-theme')).not.toBeNull();
  });
});
