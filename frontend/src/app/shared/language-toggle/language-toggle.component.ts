import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageService, SUPPORTED_LANGUAGES } from '../../core/i18n/language.service';

/**
 * The toolbar language switch: one button per supported language, marking the active one. It owns
 * no state, because the choice belongs to the language service - every control that offers the
 * same choice therefore stays in step without any of them knowing about the others.
 */
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
