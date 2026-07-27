import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LanguageService } from '../../core/i18n/language.service';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { LanguageToggleComponent } from './language-toggle.component';

const TRANSLATIONS = {
  en: { common: { language: 'Language' } },
  de: { common: { language: 'Sprache' } }
};

describe('LanguageToggleComponent', () => {
  let fixture: ComponentFixture<LanguageToggleComponent>;

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.lang-button')
    ).find((candidate) => candidate.textContent?.trim() === label);
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [LanguageToggleComponent],
      providers: [provideTestTranslations(TRANSLATIONS)]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(LanguageToggleComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('render_supportedLanguages_showsOneButtonPerLanguage', () => {
    expect(button('EN')).toBeDefined();
    expect(button('DE')).toBeDefined();
  });

  it('render_defaultLanguage_marksEnglishActive', () => {
    expect(button('EN')?.classList.contains('active')).toBe(true);
    expect(button('DE')?.classList.contains('active')).toBe(false);
  });

  it('click_deButton_updatesLanguageServiceAndActiveState', async () => {
    button('DE')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(TestBed.inject(LanguageService).currentLang()).toBe('de');
    expect(button('DE')?.classList.contains('active')).toBe(true);
    expect(button('EN')?.classList.contains('active')).toBe(false);
  });
});
