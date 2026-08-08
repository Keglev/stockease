import { Component, computed, inject } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import { DATE_FORMATS, FormatService, NUMBER_FORMATS } from '../../core/format/format.service';
import { LanguageService, SUPPORTED_LANGUAGES } from '../../core/i18n/language.service';
import { THEME_MODES, ThemeService } from '../../core/theme/theme.service';
import { AppDateTimePipe } from '../../shared/format/app-date-time.pipe';

/** The amount the number options are previewed with; large enough to show a grouping separator. */
const SAMPLE_AMOUNT = 1234.56;

/**
 * Where the preferences scattered across the toolbar are stated in one place.
 *
 * @remarks
 * It owns no state. Both controls read and write the same services the toolbar toggles do, so a
 * change here and a change there are the same event - including the persistence, which is
 * localStorage per browser rather than anything the backend knows about (ADR 030). Anyone looking
 * for where the preference is really kept should look at the services, not here.
 */
@Component({
  selector: 'app-settings',
  imports: [
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    TranslatePipe,
    AppDateTimePipe
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);
  private readonly format = inject(FormatService);
  private readonly auth = inject(AuthService);

  // Read straight off the auth service: these describe the token, and this page only displays them.
  protected readonly username = this.auth.username;
  protected readonly role = this.auth.role;
  protected readonly loginTime = this.auth.loginTime;

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

  /**
   * The format options, each previewed with a real value rendered the way that option would render
   * it. The preview IS the label - "31.12.2026" needs no translating and settles what "dmyDot"
   * means faster than any wording could, in either language.
   *
   * <p>Computed, so the previews follow the interface language while 'auto' is selected and the
   * reader can see what automatic currently resolves to.
   */
  protected readonly dateOptions = computed(() =>
    DATE_FORMATS.map((value) => ({
      value,
      // Today rather than a fixed date: a reader checks a format against the date they know it is.
      preview: value === 'auto' ? '' : this.format.previewDate(value, new Date())
    }))
  );

  protected readonly numberOptions = computed(() =>
    NUMBER_FORMATS.map((value) => ({
      value,
      preview: value === 'auto' ? '' : this.format.previewCurrency(value, SAMPLE_AMOUNT)
    }))
  );

  protected readonly currentDateFormat = this.format.dateFormat;
  protected readonly currentNumberFormat = this.format.numberFormat;

  protected setDateFormat(value: string): void {
    this.format.setDateFormat(value);
  }

  protected setNumberFormat(value: string): void {
    this.format.setNumberFormat(value);
  }
}
