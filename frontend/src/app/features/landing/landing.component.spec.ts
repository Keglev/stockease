import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { ApiEnvelope } from '../../core/api/api-envelope';
import { AuthService, UserRole } from '../../core/auth/auth.service';
import { HealthProbe, HealthService } from '../../core/health/health.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ThemeService } from '../../core/theme/theme.service';
import { NotificationService } from '../../core/notifications/notification.service';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { LandingComponent } from './landing.component';

/** The rendered result once {{app}} is interpolated from common.appName. */
const DESCRIPTION = 'StockEase is an inventory management application for small businesses.';

const TOKEN_ENVELOPE: ApiEnvelope<string> = {
  success: true,
  message: 'Login successful',
  data: 'header.payload.signature'
};

const TRANSLATIONS = {
  en: {
    common: { appName: 'StockEase', language: 'Language' },
    footer: { tagline: 'Inventory management demo', apiLatency: 'API {{ms}} ms' },
    landing: {
      description: '{{app}} is an inventory management application for small businesses.',
      demo: {
        title: 'Try the demo',
        tryAdmin: 'Try as Admin',
        tryUser: 'Try as User',
        resetNotice: 'Demo data - resets nightly at 03:00 UTC'
      },
      loginCta: 'Login',
      screenshots: {
        title: 'A look inside',
        dashboard: 'Dashboard with key figures and charts',
        profit: 'COGS-based profit reporting',
        cashflow: 'Payment-basis cash flow over time',
        duedates: 'Due-date monitoring'
      }
    }
  },
  de: {
    common: { appName: 'Bestandskontrolle', language: 'Sprache' },
    landing: {
      loginCta: 'Anmelden',
      screenshots: {
        title: 'Ein Blick in die Anwendung',
        dashboard: 'Dashboard mit Kennzahlen und Diagrammen',
        profit: 'Gewinnbericht auf Wareneinsatzbasis',
        cashflow: 'Cashflow im Zeitverlauf auf Zahlungsbasis',
        duedates: 'Überwachung der Fälligkeiten'
      }
    }
  }
};

/** Keeps the footer's health poll off the network; the real probe has its own spec. */
class HealthServiceStub {
  check() {
    return of<HealthProbe>({ up: true, latencyMs: 12 });
  }
}

class AuthServiceStub {
  readonly calls: UserRole[] = [];
  result: Observable<ApiEnvelope<string>> = of(TOKEN_ENVELOPE);

  demoLogin(role: UserRole): Observable<ApiEnvelope<string>> {
    this.calls.push(role);
    return this.result;
  }
}

class NotificationServiceStub {
  readonly errors: string[] = [];

  error(message: string): void {
    this.errors.push(message);
  }
}

describe('LandingComponent', () => {
  let fixture: ComponentFixture<LandingComponent>;
  let auth: AuthServiceStub;
  let notifications: NotificationServiceStub;

  function link(href: string): HTMLAnchorElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      `a[href="${href}"]`
    );
  }

  function demoButton(role: 'admin' | 'user'): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      `button.demo-${role}`
    );
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    auth = new AuthServiceStub();
    notifications = new NotificationServiceStub();

    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        // Registered so the post-demo-login navigation resolves instead of rejecting mid-test.
        provideRouter([{ path: 'app', children: [] }]),
        provideTestTranslations(TRANSLATIONS),
        { provide: AuthService, useValue: auth },
        { provide: NotificationService, useValue: notifications },
        { provide: HealthService, useValue: new HealthServiceStub() }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('render_defaultLanguage_showsTranslatedDescription', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(DESCRIPTION);
  });

  /** Points the page at one language/theme pair and lets the recomputed sources render. */
  async function choose(lang: string, theme: string): Promise<void> {
    TestBed.inject(LanguageService).setLanguage(lang);
    TestBed.inject(ThemeService).setTheme(theme);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function screenshotSources(): (string | null)[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.landing-screenshot img')).map((img) =>
      img.getAttribute('src')
    );
  }

  it('screenshots_default_renderFourFiguresWithComputedSrc', async () => {
    await choose('de', 'light');

    expect(screenshotSources()).toEqual([
      '/assets/landing/dashboard-de-light.png',
      '/assets/landing/profit-de-light.png',
      '/assets/landing/cashflow-de-light.png',
      '/assets/landing/duedates-de-light.png'
    ]);
    // A screenshot with no alt is a decoration, and these carry the argument of the section
    const alts = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.landing-screenshot img'));
    expect(alts).toHaveLength(4);
    expect(alts.every((img) => (img.getAttribute('alt') ?? '').length > 0)).toBe(true);
  });

  it('screenshots_languageAndThemeChange_swapAllSources', async () => {
    await choose('de', 'light');

    await choose('en', 'dark');

    // all four follow both toggles at once - the swap is what the section exists to demonstrate
    expect(screenshotSources()).toEqual([
      '/assets/landing/dashboard-en-dark.png',
      '/assets/landing/profit-en-dark.png',
      '/assets/landing/cashflow-en-dark.png',
      '/assets/landing/duedates-en-dark.png'
    ]);
  });

  it('render_loginCta_pointsAtLoginRoute', () => {
    const cta = link('/login');

    expect(cta).not.toBeNull();
    expect(cta?.textContent?.trim()).toBe('Login');
  });

  it('render_outwardLinks_comeFromTheFooterNotTheHero', () => {
    const host = fixture.nativeElement as HTMLElement;
    const repository = link('https://github.com/Keglev/stockease');

    // The hero's own duplicate row is gone; the footer is now the single source of both links.
    expect(host.querySelector('.landing-links')).toBeNull();
    expect(repository?.closest('app-footer')).not.toBeNull();
    // New-tab links must not hand the opener reference to the target page.
    expect(repository?.getAttribute('rel')).toBe('noopener');
    expect(repository?.getAttribute('target')).toBe('_blank');
  });

  it('render_default_showsFooter', () => {
    const host = fixture.nativeElement as HTMLElement;

    // The public pages carry the same bottom chrome as the authenticated shell.
    expect(host.querySelector('app-footer')).not.toBeNull();
    expect(host.querySelector('app-footer .footer-documentation')).not.toBeNull();
  });

  it('render_languageToggle_isPresentBeforeLogin', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-language-toggle')
    ).not.toBeNull();
  });

  it('render_themeToggle_isPresentBeforeLogin', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-theme-toggle')
    ).not.toBeNull();
  });

  it('render_demoBlock_showsBothRolesAndTheResetNotice', () => {
    expect(demoButton('admin')?.textContent?.trim()).toBe('Try as Admin');
    expect(demoButton('user')?.textContent?.trim()).toBe('Try as User');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Demo data - resets nightly at 03:00 UTC'
    );
  });

  it('demoAdmin_clicked_signsInAsAdminAndEntersTheApp', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    demoButton('admin')?.click();
    await fixture.whenStable();

    expect(auth.calls).toEqual(['ADMIN']);
    expect(navigate).toHaveBeenCalledWith(['/app']);
  });

  it('demoUser_clicked_signsInAsUser', async () => {
    demoButton('user')?.click();
    await fixture.whenStable();

    expect(auth.calls).toEqual(['USER']);
  });

  it('demoLogin_rejected_notifiesAndReEnablesBothButtons', async () => {
    auth.result = throwError(() => new Error('Demo mode is off.'));

    demoButton('admin')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(notifications.errors).toEqual(['Demo mode is off.']);
    expect(demoButton('admin')?.disabled).toBe(false);
    expect(demoButton('user')?.disabled).toBe(false);
  });

  it('demoLogin_inFlight_disablesBothButtons', () => {
    // Never completes, so the click leaves the component in its pending state for the assertion.
    auth.result = new Subject<ApiEnvelope<string>>();

    demoButton('admin')?.click();
    fixture.detectChanges();

    expect(demoButton('admin')?.disabled).toBe(true);
    expect(demoButton('user')?.disabled).toBe(true);
  });
});
