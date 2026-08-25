import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import { IdleLogoutService } from '../../core/auth/idle-logout.service';
import { DEMO_MODE } from '../../core/config/demo-mode';
import { LocalizedPaginatorIntl } from '../../core/i18n/localized-paginator-intl';
import { DESKTOP_MEDIA_QUERY, PHONE_MEDIA_QUERY } from '../../core/layout/layout';
import { FooterComponent } from '../footer/footer.component';
import { LanguageToggleComponent } from '../language-toggle/language-toggle.component';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

/**
 * The frame around every authenticated page: toolbar, navigation drawer and the routed outlet.
 *
 * @remarks
 * It exists only behind the auth guard, which is what makes it the right owner of the idle timer:
 * the countdown cannot run while a visitor reads a public page, and it stops when the shell is
 * destroyed (ADR 032).
 */
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
  // Provided here rather than in app.config: MatPaginatorIntl reaches Material's paginator entry
  // point, which pulls select, forms, form-field and tooltip - ~328 kB that the initial bundle
  // does not otherwise need. This component is lazily loaded and every paginator renders inside
  // its outlet, so the subtree loads with the shell instead of at bootstrap.
  providers: [{ provide: MatPaginatorIntl, useClass: LocalizedPaginatorIntl }],
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

  // The toolbar is a single non-wrapping row, so at phone width it has to carry fewer things rather
  // than smaller ones. Seeded from isMatched for the same reason isDesktop is: the first paint
  // should already be the right toolbar instead of flashing the wide one.
  protected readonly isPhone = signal(this.breakpoints.isMatched(PHONE_MEDIA_QUERY));

  protected readonly sidenavOpened = signal(this.isDesktop());

  private readonly idle = inject(IdleLogoutService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  /** The open warning, so activity elsewhere and the logout itself can take it back. */
  private warningRef: MatSnackBarRef<TextOnlySnackBar> | null = null;

  constructor() {
    this.breakpoints
      .observe(PHONE_MEDIA_QUERY)
      .pipe(takeUntilDestroyed())
      .subscribe((state) => this.isPhone.set(state.matches));

    this.breakpoints
      .observe(DESKTOP_MEDIA_QUERY)
      .pipe(takeUntilDestroyed())
      .subscribe((state) => {
        this.isDesktop.set(state.matches);
        // A tier change resets the sidenav rather than carrying the previous tier's state over:
        // on desktop it is permanent furniture, below desktop it is a transient overlay.
        this.sidenavOpened.set(state.matches);
      });

    // Started here rather than at bootstrap because this component IS the authenticated area: it
    // exists only behind the guard, so the timer cannot run while a visitor reads the landing page.
    this.idle.start();
    this.destroyRef.onDestroy(() => {
      this.idle.stop();
      this.warningRef?.dismiss();
    });

    effect(() => (this.idle.warningActive() ? this.showWarning() : this.warningRef?.dismiss()));
  }

  /**
   * Raises the idle warning, and keeps a handle so it can be taken back.
   *
   * <p>No duration: a warning that disappears on its own is worse than none, because it leaves the
   * reader signed out with no memory of being told. It goes when it is answered, when activity
   * elsewhere clears the warning, or when the logout it announced actually happens.
   */
  private showWarning(): void {
    this.warningRef = this.snackBar.open(
      this.translate.instant('shell.idleWarning') as string,
      this.translate.instant('shell.idleStay') as string
    );
    // Pressing the action is activity the service cannot see: the click lands in the overlay, not
    // on the document, so it is reported rather than inferred.
    this.warningRef.onAction().subscribe(() => this.idle.notifyActivity());
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
