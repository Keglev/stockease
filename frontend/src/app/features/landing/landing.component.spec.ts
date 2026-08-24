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
import { ApiError } from '../../core/api/api-envelope';

/* The rendered result once {{app}} is interpolated from common.appName. */
const DESCRIPTION = 'StockEase is an inventory management application for small businesses.';

const TOKEN_ENVELOPE: ApiEnvelope<string> = {
  success: true,
  message: 'Login successful',
  data: 'header.payload.signature'
};

const TRANSLATIONS = {
  en: {
    common: {
      appName: 'StockEase',
      language: 'Language',
      errors: { serverError: 'A server error occurred. Please try again later.' }
    },
    footer: { tagline: 'Inventory management demo', apiLatency: 'API {{ms}} ms' },
    landing: {
      description: '{{app}} is an inventory management application for small businesses.',
      hero: { eyebrow: 'INVENTORY MANAGEMENT', headline: "Know what's in stock." },
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
      },
      features: {
        title: "What's inside",
        subtitle: 'Six building blocks.',
        inventory: { title: 'Products and stock', text: 'Master data.' },
        invoices: { title: 'Invoice lifecycle', text: 'Purchases and sales.' },
        profit: { title: 'Honest profit', text: 'Cost at the moment of sale.' },
        cashflow: { title: 'Cash flow over time', text: 'Money counts when paid.' },
        audit: { title: 'Complete history', text: 'Every change with its actor.' },
        i18n: { title: 'German and English', text: 'Both languages, both themes.' }
      },
      steps: {
        title: 'How it works',
        one: { title: 'Open the demo', text: 'One click.' },
        two: { title: 'Run stock through invoices', text: 'Book purchases and sales.' },
        three: { title: 'Read the numbers', text: 'Seven reports.' }
      },
      tech: {
        title: 'Built like production software',
        text: 'Spring Boot on Java 21.',
        docs: 'Read the architecture docs',
        source: 'View source on GitHub'
      },
      cta: { title: 'See it with real data', text: 'The demo resets nightly.' }
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

/* Keeps the footer's health poll off the network; the real probe has its own spec. */
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

/*
 * The public entry page: it describes the product, stages the screenshots for the current language and
 * theme, and offers both demo roles. The demo buttons sign in and enter the application, are disabled
 * while in flight, and re-enable on rejection.
 * Out of scope: what happens after entry - login.component.spec.ts and the authenticated shell.
 */
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

  /* Points the page at one language/theme pair and lets the recomputed sources render. */
  async function choose(lang: string, theme: string): Promise<void> {
    TestBed.inject(LanguageService).setLanguage(lang);
    TestBed.inject(ThemeService).setTheme(theme);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /* Hero shot first, then the gallery's three - the order the page stages them in. */
  function screenshotSources(): (string | null)[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.hero-figure img, .gallery-item img'
      )
    ).map((img) => img.getAttribute('src'));
  }

  it('screenshots_default_stageTheDashboardInTheHeroAndTheRestInTheGallery', async () => {
    await choose('de', 'light');
    const host = fixture.nativeElement as HTMLElement;

    expect(screenshotSources()).toEqual([
      '/assets/landing/dashboard-de-light.png',
      '/assets/landing/profit-de-light.png',
      '/assets/landing/cashflow-de-light.png',
      '/assets/landing/duedates-de-light.png'
    ]);
    // the dashboard is the hero's alone; the gallery carries the three reporting screens
    expect(host.querySelectorAll('.hero-figure img')).toHaveLength(1);
    expect(host.querySelectorAll('.gallery-item img')).toHaveLength(3);
    // A screenshot with no alt is a decoration, and these carry the argument of the page
    const shots = Array.from(host.querySelectorAll('.hero-figure img, .gallery-item img'));
    expect(shots.every((img) => (img.getAttribute('alt') ?? '').length > 0)).toBe(true);
  });

  it('screenshots_languageAndThemeChange_swapHeroAndGallerySources', async () => {
    await choose('de', 'light');

    await choose('en', 'dark');

    // all four follow both toggles at once - the swap is what the screenshots exist to demonstrate
    expect(screenshotSources()).toEqual([
      '/assets/landing/dashboard-en-dark.png',
      '/assets/landing/profit-en-dark.png',
      '/assets/landing/cashflow-en-dark.png',
      '/assets/landing/duedates-en-dark.png'
    ]);
  });

  it('render_heroShot_loadsEagerlyWhileTheGalleryWaits', () => {
    const host = fixture.nativeElement as HTMLElement;

    // Above the fold, so deferring it would show the visitor an empty frame on arrival.
    expect(host.querySelector('.hero-figure img')?.getAttribute('loading')).toBe('eager');
    expect(host.querySelector('.gallery-item img')?.getAttribute('loading')).toBe('lazy');
  });

  it('render_loginCta_pointsAtLoginRoute', () => {
    const cta = link('/login');

    expect(cta).not.toBeNull();
    expect(cta?.textContent?.trim()).toBe('Login');
  });

  it('render_credibilityBand_linksTheDocsAndTheRepositorySafely', () => {
    const host = fixture.nativeElement as HTMLElement;
    const actions = Array.from(host.querySelectorAll<HTMLAnchorElement>('.band-actions a'));

    // Both destinations come from the same constants the footer reads, so they cannot drift.
    expect(actions.map((anchor) => anchor.getAttribute('href'))).toEqual([
      'https://keglev.github.io/stockease/',
      'https://github.com/Keglev/stockease'
    ]);
    // New-tab links must not hand the opener reference to the target page.
    expect(actions.every((anchor) => anchor.getAttribute('rel') === 'noopener')).toBe(true);
    expect(actions.every((anchor) => anchor.getAttribute('target') === '_blank')).toBe(true);
  });

  it('render_default_showsSixFeatureCardsAndThreeSteps', () => {
    const host = fixture.nativeElement as HTMLElement;
    const icons = Array.from(host.querySelectorAll('.feature-icon')).map((icon) =>
      icon.textContent?.trim()
    );

    expect(host.querySelectorAll('.feature-card')).toHaveLength(6);
    expect(icons).toEqual([
      'inventory_2',
      'receipt_long',
      'payments',
      'account_balance',
      'history',
      'translate'
    ]);
    expect(host.querySelectorAll('.step')).toHaveLength(3);
    // The visible numerals are the walkthrough's order, which the copy alone does not state.
    expect(Array.from(host.querySelectorAll('.step-number')).map((n) => n.textContent)).toEqual([
      '1',
      '2',
      '3'
    ]);
  });

  it('render_closingBand_repeatsTheDemoEntryAndTheLoginCta', () => {
    const actions = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.landing-cta .landing-demo-actions *')
    );

    // A visitor who scrolled this far lost the hero's buttons long ago.
    expect(actions.some((element) => element.classList.contains('demo-admin'))).toBe(true);
    expect(actions.some((element) => element.getAttribute('href') === '/login')).toBe(true);
  });

  it('render_default_showsFooter', () => {
    const host = fixture.nativeElement as HTMLElement;

    // The public pages carry the same bottom chrome as the authenticated shell.
    expect(host.querySelector('app-footer')).not.toBeNull();
    expect(host.querySelector('app-footer .footer-documentation')).not.toBeNull();
  });

  it('render_default_showsTheSharedPublicHeaderWithBothToggles', () => {
    const header = (fixture.nativeElement as HTMLElement).querySelector('app-public-header');

    // The toggles moved into the brand header; they must still be reachable before login, because
    // the screenshots below only prove anything if the visitor can press them.
    expect(header).not.toBeNull();
    expect(header?.querySelector('app-language-toggle')).not.toBeNull();
    expect(header?.querySelector('app-theme-toggle')).not.toBeNull();
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

  it('closingBandDemoAdmin_clicked_signsInToo', async () => {
    // The page offers the demo twice; the second offer is the one a visitor who read to the end
    // reaches, and it has its own handler binding rather than sharing the hero button's.
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      'button.demo-admin'
    );
    expect(buttons.length).toBe(2);

    buttons[1].click();
    await fixture.whenStable();

    expect(auth.calls).toEqual(['ADMIN']);
  });

  it('demoAdmin_clickedTwiceBeforeRerender_signsInOnce', async () => {
    // The disabled binding cannot have been applied yet between two clicks in the same task, so
    // the pending guard is the only thing standing between a double click and two races logins.
    auth.result = new Subject<ApiEnvelope<string>>();

    demoButton('admin')?.click();
    demoButton('admin')?.click();

    expect(auth.calls).toEqual(['ADMIN']);
  });

  it('demoUser_clicked_signsInAsUser', async () => {
    demoButton('user')?.click();
    await fixture.whenStable();

    expect(auth.calls).toEqual(['USER']);
  });

  it('demoLogin_serverError_notifiesWithTheCatalogSentenceNotTheWireSentence', async () => {
    // The demo notification routes through the resolver now. Strong form: the catalog sentence
    // present, the wire sentence absent, and the two share no wording.
    auth.result = throwError(() => new ApiError('Demo mode is off.', 500, undefined, undefined));

    demoButton('admin')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(notifications.errors).toEqual(['A server error occurred. Please try again later.']);
    expect(notifications.errors).not.toContain('Demo mode is off.');
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
