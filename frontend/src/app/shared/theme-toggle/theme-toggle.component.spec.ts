import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThemeService } from '../../core/theme/theme.service';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { ThemeToggleComponent } from './theme-toggle.component';

const TRANSLATIONS = {
  en: { common: { themeLight: 'Light mode', themeDark: 'Dark mode' } }
};

/*
 * The icon offers the action rather than naming the current mode, and a click writes through to the
 * theme service rather than holding state here.
 * Out of scope: how the theme is resolved and stored - theme.service.spec.ts.
 */
describe('ThemeToggleComponent', () => {
  let fixture: ComponentFixture<ThemeToggleComponent>;
  let theme: ThemeService;

  function icon(): string {
    return (
      (fixture.nativeElement as HTMLElement).querySelector('mat-icon')?.textContent?.trim() ?? ''
    );
  }

  function button(): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('button');
  }

  async function setUp(mode: 'light' | 'dark'): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
      providers: [provideTestTranslations(TRANSLATIONS)]
    }).compileComponents();

    theme = TestBed.inject(ThemeService);
    theme.setTheme(mode);

    fixture = TestBed.createComponent(ThemeToggleComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.colorScheme = '';
    TestBed.resetTestingModule();
  });

  it('render_lightMode_showsMoonIconOfferingDark', async () => {
    await setUp('light');

    expect(icon()).toBe('dark_mode');
    expect(button()?.getAttribute('aria-label')).toBe('Dark mode');
  });

  it('render_darkMode_showsSunIconOfferingLight', async () => {
    await setUp('dark');

    expect(icon()).toBe('light_mode');
    expect(button()?.getAttribute('aria-label')).toBe('Light mode');
  });

  it('click_button_togglesThemeService', async () => {
    await setUp('light');
    const toggle = vi.spyOn(theme, 'toggle');

    button()?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(toggle).toHaveBeenCalledOnce();
    expect(theme.currentTheme()).toBe('dark');
    expect(icon()).toBe('light_mode');
  });
});
