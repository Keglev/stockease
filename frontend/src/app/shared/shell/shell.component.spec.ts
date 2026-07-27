import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LanguageService } from '../../core/i18n/language.service';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { ShellComponent } from './shell.component';

const TRANSLATIONS = {
  en: {
    common: { appName: 'StockEase', language: 'Language' },
    nav: { dashboard: 'Overview', products: 'Products' },
    shell: { logout: 'Log out', role: { ADMIN: 'Administrator', USER: 'User' } }
  },
  de: {
    common: { appName: 'StockEase', language: 'Sprache' },
    nav: { dashboard: 'Übersicht', products: 'Produkte' },
    shell: { logout: 'Abmelden', role: { ADMIN: 'Administrator', USER: 'Benutzer' } }
  }
};

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function langButton(label: string): HTMLButtonElement | undefined {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.lang-button')
    ).find((button) => button.textContent?.trim() === label);
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTestTranslations(TRANSLATIONS)
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('render_defaultLanguage_showsEnglishNavigation', () => {
    expect(text()).toContain('Products');
    expect(text()).not.toContain('Produkte');
  });

  it('switchLanguage_deToggleClicked_showsGermanNavigation', async () => {
    expect(text()).toContain('Products');

    langButton('DE')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(text()).toContain('Produkte');
    expect(text()).toContain('Übersicht');
    expect(text()).toContain('Abmelden');
    expect(text()).not.toContain('Log out');
  });

  it('switchLanguage_deToggleClicked_marksActiveLanguage', async () => {
    expect(langButton('EN')?.classList.contains('active')).toBe(true);

    langButton('DE')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(langButton('DE')?.classList.contains('active')).toBe(true);
    expect(langButton('EN')?.classList.contains('active')).toBe(false);
  });
});
