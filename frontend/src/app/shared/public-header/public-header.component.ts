import { Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageToggleComponent } from '../language-toggle/language-toggle.component';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

/**
 * Brand bar for the four pages that exist outside the authenticated shell: landing, login, logout
 * and the 404. Those pages used to open with two toggle buttons floating in an empty corner, which
 * left every one of them anchorless - a visitor could not tell what product they were looking at
 * until they read the body copy.
 *
 * <p>It is the shell's toolbar minus everything that describes a session: no navigation, no role,
 * no logout, and no DEMO badge, because that badge marks being signed into the demo rather than
 * the deployment being one.
 */
@Component({
  selector: 'app-public-header',
  imports: [
    LanguageToggleComponent,
    ThemeToggleComponent,
    MatToolbarModule,
    RouterLink,
    TranslatePipe
  ],
  templateUrl: './public-header.component.html',
  styleUrl: './public-header.component.scss'
})
export class PublicHeaderComponent {}
