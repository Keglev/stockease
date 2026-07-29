import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import { DEMO_MODE } from '../../core/config/demo-mode';
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

  // Only the role is available in state; the backend does not return the username on login.
  protected readonly role = this.auth.role;

  // Injected through a token rather than read from the environment import so the spec can render
  // this component both ways; see DEMO_MODE for why the seam exists.
  protected readonly demoMode = inject(DEMO_MODE);

  protected logout(): void {
    // Clear state before navigating so no guarded route can observe a stale session.
    this.auth.logout();
    void this.router.navigate(['/logout']);
  }
}
