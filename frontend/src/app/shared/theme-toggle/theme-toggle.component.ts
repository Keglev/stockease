import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-theme-toggle',
  imports: [MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss'
})
export class ThemeToggleComponent {
  private readonly theme = inject(ThemeService);

  protected readonly isDark = computed(() => this.theme.currentTheme() === 'dark');

  // The icon and label describe the ACTION, not the current mode: in dark mode the
  // button offers the sun (switch to light).
  protected readonly icon = computed(() => (this.isDark() ? 'light_mode' : 'dark_mode'));
  protected readonly label = computed(() =>
    this.isDark() ? 'common.themeLight' : 'common.themeDark'
  );

  protected toggle(): void {
    this.theme.toggle();
  }
}
