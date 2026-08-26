import { AfterViewInit, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService, UserRole } from '../../core/auth/auth.service';
import { DOCUMENTATION_URL, REPOSITORY_URL } from '../../core/config/external-links';
import { ErrorMessageService } from '../../core/i18n/error-message.service';
import { LanguageService, SUPPORTED_LANGUAGES } from '../../core/i18n/language.service';
import { NotificationService } from '../../core/notifications/notification.service';
import { THEME_MODES, ThemeService } from '../../core/theme/theme.service';
import { FooterComponent } from '../../shared/footer/footer.component';
import { PublicHeaderComponent } from '../../shared/public-header/public-header.component';

/** The four screens the landing shows, in the order a visitor meets them inside the app. */
const SCREENSHOT_PAGES = ['dashboard', 'profit', 'cashflow', 'duedates'] as const;

/**
 * The strict naming contract the sixteen assets are held to: `<page>-<lang>-<theme>.png`. One
 * function rather than the same template literal in two places, so the set on screen and the set
 * being warmed cannot come to disagree about how a filename is spelled.
 */
function screenshotSrc(page: string, lang: string, theme: string): string {
  return `/assets/landing/${page}-${lang}-${theme}.png`;
}

/** The four screens for one language and theme, in the order the page stages them. */
function screenshotSet(lang: string, theme: string): string[] {
  return SCREENSHOT_PAGES.map((page) => screenshotSrc(page, lang, theme));
}

/**
 * The twelve screenshots that are not on screen, ordered by how soon a visitor is likely to ask
 * for them: this language's other theme first, then the other language in the theme they are
 * reading in, then its other theme.
 *
 * <p>The order is the argument. Either toggle costs four files, and both toggles sit side by side
 * in the header, so the question is only which one gets pressed first - and a reader who has
 * already chosen a language is likelier to try the other theme than to change their mind about
 * the language.
 *
 * <p>Exported for its own test: the order is the whole point of the function, and reading twelve
 * constructed Image objects back out would say less about it than reading the list.
 */
export function screenshotPrefetchOrder(lang: string, theme: string): string[] {
  const otherLang = SUPPORTED_LANGUAGES.find((candidate) => candidate !== lang) ?? lang;
  const otherTheme = THEME_MODES.find((candidate) => candidate !== theme) ?? theme;

  return [
    ...screenshotSet(lang, otherTheme),
    ...screenshotSet(otherLang, theme),
    ...screenshotSet(otherLang, otherTheme)
  ];
}

/** Pixel dimensions every screenshot shares; declared on the img so the grid reserves its space. */
const SCREENSHOT_WIDTH = 1913;
const SCREENSHOT_HEIGHT = 868;

/**
 * The six capability cards, each an icon plus a `landing.features.<key>` title/text pair. Held as
 * data rather than six hand-written blocks in the template: the cards differ only in those three
 * values, and a repeated block invites the seventh to be written slightly differently.
 */
const FEATURES = [
  { key: 'inventory', icon: 'inventory_2' },
  { key: 'invoices', icon: 'receipt_long' },
  { key: 'profit', icon: 'payments' },
  { key: 'cashflow', icon: 'account_balance' },
  { key: 'audit', icon: 'history' },
  { key: 'i18n', icon: 'translate' }
] as const;

/** The walkthrough steps, numbered in the template from their position here. */
const STEPS = ['one', 'two', 'three'] as const;

/**
 * Public entry page: describes the application and offers the two ways into it, a normal login
 * and one-click demo access. It is the only route that calls the demo-login endpoint.
 */
@Component({
  selector: 'app-landing',
  imports: [
    FooterComponent,
    PublicHeaderComponent,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
    TranslatePipe
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly errorMessages = inject(ErrorMessageService);
  private readonly language = inject(LanguageService);
  private readonly theme = inject(ThemeService);

  protected readonly screenshotWidth = SCREENSHOT_WIDTH;
  protected readonly screenshotHeight = SCREENSHOT_HEIGHT;

  protected readonly features = FEATURES;
  protected readonly steps = STEPS;

  protected readonly documentationUrl = DOCUMENTATION_URL;
  protected readonly repositoryUrl = REPOSITORY_URL;

  /**
   * The four screenshots, re-pointed whenever the visitor changes language or theme.
   *
   * <p>Sixteen assets exist under a strict naming contract - `<page>-<lang>-<theme>.png` for the
   * four pages, both languages and both schemes - and four are on screen at a time, one staged in
   * the hero and three in the gallery further down. Recomputing the
   * paths from the page's own toggles is the entire point: a landing page can claim it is
   * translated and themed, or it can change in front of the visitor when they press the toggles,
   * and the second is the only one that proves anything.
   */
  protected readonly screenshots = computed(() => {
    const lang = this.language.currentLang();
    const theme = this.theme.currentTheme();
    return SCREENSHOT_PAGES.map((page) => ({
      page,
      src: screenshotSrc(page, lang, theme)
    }));
  });

  /**
   * The dashboard shot, staged large in the hero: it is the screen a visitor lands on inside the
   * app, so it is the one that has to carry the first impression.
   */
  protected readonly heroScreenshot = computed(() => this.screenshots()[0]);

  /** The remaining three, staged small in the gallery further down the page. */
  protected readonly galleryScreenshots = computed(() => this.screenshots().slice(1));

  // One flag covers both buttons rather than one each: a second click during the first request
  // would race two logins for two different roles, leaving whichever landed last in storage.
  protected readonly demoPending = signal(false);

  /** Warms the other twelve screenshots once this page has actually rendered its own four. */
  ngAfterViewInit(): void {
    this.prefetchOtherScreenshots();
  }

  /**
   * Fetches the twelve off-screen screenshots into the browser cache while the page is idle.
   *
   * <p>Pressing either toggle swaps all four images at once, and on a cold edge one of those files
   * measured 2.88 s - so the demonstration the page is built around, that it really is translated
   * and really is themed, played out as four empty frames. The bytes are the same bytes either
   * way; this only decides whether they are paid for while the visitor is reading or while they
   * are waiting.
   *
   * <p>Deferred to an idle callback rather than fired on render, because these are the least
   * important requests the page makes: they compete with the four images actually on screen and
   * must lose. The two-second timeout is the fallback for browsers without the callback, which is
   * long enough for the visible four to be done.
   *
   * <p>Skipped outright under prefers-reduced-data. Speculative fetching is exactly what that
   * setting is asking not to happen, and twelve full-page PNGs is a poor thing to spend a metered
   * connection on. The `media` check is the feature detection: an unsupported query normalizes to
   * "not all" rather than throwing, which would otherwise read as a settled "no".
   */
  private prefetchOtherScreenshots(): void {
    // Server-side rendering and any test renderer without a DOM: there is no cache to warm.
    if (typeof window === 'undefined') {
      return;
    }

    const reducedData = window.matchMedia?.('(prefers-reduced-data: reduce)');
    if (reducedData && reducedData.media !== 'not all' && reducedData.matches) {
      return;
    }

    const warm = (): void => {
      // Read at run time rather than closed over: the visitor may have toggled during the wait,
      // in which case the set worth warming is the one they are not looking at now.
      for (const src of screenshotPrefetchOrder(
        this.language.currentLang(),
        this.theme.currentTheme()
      )) {
        // The request is the point; the element is discarded and the bytes stay in the HTTP cache.
        new Image().src = src;
      }
    };

    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(warm);
    } else {
      window.setTimeout(warm, 2000);
    }
  }

  /** Signs in as the demo account for the requested role and enters the application. */
  protected enterDemo(role: UserRole): void {
    if (this.demoPending()) {
      return;
    }
    this.demoPending.set(true);

    this.auth.demoLogin(role).subscribe({
      next: () => {
        // The flag is deliberately NOT cleared here. Between the token arriving and the shell's
        // first paint of /app there is a route load and a guard to run, and clearing it on the
        // response put the button back to "Try as Admin" for that whole interval - an enabled
        // button on a page that is already on its way out, which invites the second click the
        // pending guard exists to refuse. It stays pending until this page is gone.
        void this.router.navigate(['/app']).then((navigated) => {
          // Unless the navigation was refused or cancelled, in which case the visitor is still
          // here and the button has to work again.
          if (!navigated) {
            this.demoPending.set(false);
          }
        });
      },
      error: (error: Error) => {
        this.demoPending.set(false);
        // Through the resolver, which changes nothing below 500 and everything at it. This
        // endpoint does carry a body - the role - but it is whichever of the two buttons was
        // pressed rather than anything typed, and the only refusal the demo controller authors is
        // an unknown role, which it answers with a 400 it builds itself carrying no situation code.
        // So nothing coded can reach this handler, and an uncoded non-5xx comes back out of the
        // resolver as the server wrote it. What the resolver does own is the uncoded 5xx, which now
        // reads in the visitor's language instead of as English prose about the server (ADR 041).
        this.notifications.error(this.errorMessages.resolve(error));
      }
    });
  }
}
