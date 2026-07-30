import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { FooterComponent } from '../../../shared/footer/footer.component';
import { LanguageToggleComponent } from '../../../shared/language-toggle/language-toggle.component';
import { ThemeToggleComponent } from '../../../shared/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-logout',
  imports: [
    FooterComponent,
    LanguageToggleComponent,
    ThemeToggleComponent,
    MatButtonModule,
    MatCardModule,
    RouterLink,
    TranslatePipe
  ],
  templateUrl: './logout.component.html',
  styleUrl: './logout.component.scss'
})
export class LogoutComponent {}
