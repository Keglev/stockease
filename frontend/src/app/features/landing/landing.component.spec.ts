import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LanguageService } from '../../core/i18n/language.service';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { LandingComponent } from './landing.component';

const DESCRIPTION = 'StockEase is an inventory management application for small businesses.';

const TRANSLATIONS = {
  en: {
    common: { language: 'Language' },
    landing: {
      title: 'StockEase',
      description: DESCRIPTION,
      loginCta: 'Login',
      repository: 'GitHub repository',
      documentation: 'Documentation'
    }
  },
  de: {
    common: { language: 'Sprache' },
    landing: { loginCta: 'Anmelden' }
  }
};

describe('LandingComponent', () => {
  let fixture: ComponentFixture<LandingComponent>;

  function link(href: string): HTMLAnchorElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      `a[href="${href}"]`
    );
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideRouter([]), provideTestTranslations(TRANSLATIONS)]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('render_defaultLanguage_showsTranslatedDescription', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(DESCRIPTION);
  });

  it('render_loginCta_pointsAtLoginRoute', () => {
    const cta = link('/login');

    expect(cta).not.toBeNull();
    expect(cta?.textContent?.trim()).toBe('Login');
  });

  it('render_secondaryLinks_carryRepositoryAndDocumentationUrls', () => {
    const repository = link('https://github.com/Keglev/stockease');
    const documentation = link('https://keglev.github.io/stockease/');

    expect(repository).not.toBeNull();
    expect(documentation).not.toBeNull();
    // New-tab links must not hand the opener reference to the target page.
    expect(repository?.getAttribute('rel')).toBe('noopener');
    expect(documentation?.getAttribute('rel')).toBe('noopener');
    expect(repository?.getAttribute('target')).toBe('_blank');
    expect(documentation?.getAttribute('target')).toBe('_blank');
  });

  it('render_languageToggle_isPresentBeforeLogin', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-language-toggle')
    ).not.toBeNull();
  });
});
