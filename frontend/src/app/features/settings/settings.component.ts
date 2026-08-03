import { Component, inject } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageService, SUPPORTED_LANGUAGES } from '../../core/i18n/language.service';
import { THEME_MODES, ThemeService } from '../../core/theme/theme.service';

/**
 * Where the preferences scattered across the toolbar are stated in one place.
 *
 * <p>It owns no state. Both controls read and write the same services the toolbar toggles do, so a
 * change here and a change there are the same event - including the persistence, which is
 * localStorage per browser rather than anything the backend knows about (ADR 030). Anyone looking
 * for where the preference is really kept should look at the services, not here.
 */
@Component({
  selector: 'app-settings',
  imports: [MatButtonToggleModule, MatCardModule, TranslatePipe],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);

  protected readonly themes = THEME_MODES;
  protected readonly languages = SUPPORTED_LANGUAGES;

  // Read straight off the services rather than copied into local state: the toolbar can change
  // either of these while this page is open, and a copy would quietly disagree with the app.
  protected readonly currentTheme = this.theme.currentTheme;
  protected readonly currentLang = this.language.currentLang;

  /**
   * The label for a theme option.
   *
   * <p>Reuses the toolbar toggle's keys, which name the two modes rather than the act of switching
   * to one - so they read correctly as options here.
   */
  protected themeLabel(mode: string): string {
    return mode === 'dark' ? 'common.themeDark' : 'common.themeLight';
  }

  protected setTheme(mode: string): void {
    this.theme.setTheme(mode);
  }

  protected setLanguage(lang: string): void {
    this.language.setLanguage(lang);
  }
}
