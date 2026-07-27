import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageToggleComponent } from '../../shared/language-toggle/language-toggle.component';
import { ThemeToggleComponent } from '../../shared/theme-toggle/theme-toggle.component';

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
  protected readonly repositoryUrl = 'https://github.com/Keglev/stockease';
  protected readonly documentationUrl = 'https://keglev.github.io/stockease/';
}
