import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService, UserRole } from '../../core/auth/auth.service';
import { NotificationService } from '../../core/notifications/notification.service';
import { LanguageToggleComponent } from '../../shared/language-toggle/language-toggle.component';
import { ThemeToggleComponent } from '../../shared/theme-toggle/theme-toggle.component';

/**
 * Public entry page: describes the application and offers the two ways into it, a normal login
 * and one-click demo access. It is the only route that calls the demo-login endpoint.
 */
@Component({
  selector: 'app-landing',
  imports: [
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

  protected readonly repositoryUrl = 'https://github.com/Keglev/stockease';
  protected readonly documentationUrl = 'https://keglev.github.io/stockease/';

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
