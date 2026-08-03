import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService, UserRole } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { NotificationService } from '../../core/notifications/notification.service';
import { ThemeService } from '../../core/theme/theme.service';
import { FooterComponent } from '../../shared/footer/footer.component';
import { LanguageToggleComponent } from '../../shared/language-toggle/language-toggle.component';
import { ThemeToggleComponent } from '../../shared/theme-toggle/theme-toggle.component';

/** The four screens the landing shows, in the order a visitor meets them inside the app. */
const SCREENSHOT_PAGES = ['dashboard', 'profit', 'cashflow', 'duedates'] as const;

/** Pixel dimensions every screenshot shares; declared on the img so the grid reserves its space. */
const SCREENSHOT_WIDTH = 1913;
const SCREENSHOT_HEIGHT = 868;

/**
 * Public entry page: describes the application and offers the two ways into it, a normal login
 * and one-click demo access. It is the only route that calls the demo-login endpoint.
 */
@Component({
  selector: 'app-landing',
  imports: [
    FooterComponent,
    LanguageToggleComponent,
    ThemeToggleComponent,
    MatButtonModule,
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
  private readonly language = inject(LanguageService);
  private readonly theme = inject(ThemeService);

  protected readonly screenshotWidth = SCREENSHOT_WIDTH;
  protected readonly screenshotHeight = SCREENSHOT_HEIGHT;

  /**
   * The four screenshots, re-pointed whenever the visitor changes language or theme.
   *
   * <p>Sixteen assets exist under a strict naming contract - `<page>-<lang>-<theme>.png` for the
   * four pages, both languages and both schemes - and four are on screen at a time. Recomputing the
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
        // Shown verbatim: the text comes from the backend envelope, which has no i18n.
        this.notifications.error(error.message);
      }
    });
  }
}
