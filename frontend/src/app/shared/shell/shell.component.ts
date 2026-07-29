import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import { DEMO_MODE } from '../../core/config/demo-mode';
import { DESKTOP_MEDIA_QUERY } from '../../core/layout/layout';
import { FooterComponent } from '../footer/footer.component';
import { LanguageToggleComponent } from '../language-toggle/language-toggle.component';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-shell',
  imports: [
    FooterComponent,
    LanguageToggleComponent,
    ThemeToggleComponent,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatSidenavModule,
    MatToolbarModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslatePipe
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly breakpoints = inject(BreakpointObserver);

  // Only the role is available in state; the backend does not return the username on login.
  protected readonly role = this.auth.role;

  // Injected through a token rather than read from the environment import so the spec can render
  // this component both ways; see DEMO_MODE for why the seam exists.
  protected readonly demoMode = inject(DEMO_MODE);

  // Seeded from isMatched rather than from a default, so the first paint already has the right
  // sidenav mode instead of flipping once the observer delivers its first emission.
  protected readonly isDesktop = signal(this.breakpoints.isMatched(DESKTOP_MEDIA_QUERY));

  protected readonly sidenavOpened = signal(this.isDesktop());

  constructor() {
    this.breakpoints
      .observe(DESKTOP_MEDIA_QUERY)
      .pipe(takeUntilDestroyed())
      .subscribe((state) => {
        this.isDesktop.set(state.matches);
        // A tier change resets the sidenav rather than carrying the previous tier's state over:
        // on desktop it is permanent furniture, below desktop it is a transient overlay.
        this.sidenavOpened.set(state.matches);
      });
  }

  protected toggleSidenav(): void {
    this.sidenavOpened.update((opened) => !opened);
  }

  /** Below desktop the sidenav covers the page it navigated to, so it closes behind the click. */
  protected onNavClick(): void {
    if (!this.isDesktop()) {
      this.sidenavOpened.set(false);
    }
  }

  protected logout(): void {
    // Clear state before navigating so no guarded route can observe a stale session.
    this.auth.logout();
    void this.router.navigate(['/logout']);
  }
}
