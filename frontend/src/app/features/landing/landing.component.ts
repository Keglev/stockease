import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService, UserRole } from '../../core/auth/auth.service';
import { DOCUMENTATION_URL, REPOSITORY_URL } from '../../core/config/external-links';
import { ErrorMessageService } from '../../core/i18n/error-message.service';
import { LanguageService } from '../../core/i18n/language.service';
import { NotificationService } from '../../core/notifications/notification.service';
import { ThemeService } from '../../core/theme/theme.service';
import { FooterComponent } from '../../shared/footer/footer.component';
import { PublicHeaderComponent } from '../../shared/public-header/public-header.component';

/** The four screens the landing shows, in the order a visitor meets them inside the app. */
const SCREENSHOT_PAGES = ['dashboard', 'profit', 'cashflow', 'duedates'] as const;

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
export class LandingComponent {
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
      src: `/assets/landing/${page}-${lang}-${theme}.png`
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

  /** Signs in as the demo account for the requested role and enters the application. */
  protected enterDemo(role: UserRole): void {
    if (this.demoPending()) {
      return;
    }
    this.demoPending.set(true);

    this.auth.demoLogin(role).subscribe({
      next: () => {
        this.demoPending.set(false);
        void this.router.navigate(['/app']);
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
