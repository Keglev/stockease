import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageService, SUPPORTED_LANGUAGES } from '../../core/i18n/language.service';

@Component({
  selector: 'app-language-toggle',
  imports: [MatButtonModule, TranslatePipe],
  templateUrl: './language-toggle.component.html',
  styleUrl: './language-toggle.component.scss'
})
export class LanguageToggleComponent {
  private readonly language = inject(LanguageService);

  protected readonly languages = SUPPORTED_LANGUAGES;
  protected readonly currentLang = this.language.currentLang;

  protected switchLanguage(lang: string): void {
    this.language.setLanguage(lang);
  }
}
