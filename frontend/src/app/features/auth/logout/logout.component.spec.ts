import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LanguageService } from '../../../core/i18n/language.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { LogoutComponent } from './logout.component';

const TRANSLATIONS = {
  en: {
    common: { language: 'Language' },
    logoutPage: { message: 'You have been logged out.', backToLanding: 'Back to start page' }
  },
  de: {
    common: { language: 'Sprache' },
    logoutPage: { message: 'Sie wurden abgemeldet.', backToLanding: 'Zur Startseite' }
  }
};

describe('LogoutComponent', () => {
  let fixture: ComponentFixture<LogoutComponent>;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [LogoutComponent],
      providers: [provideRouter([]), provideTestTranslations(TRANSLATIONS)]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(LogoutComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('render_defaultLanguage_showsLoggedOutMessage', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'You have been logged out.'
    );
  });

  it('render_backAction_pointsAtLandingRoute', () => {
    const back = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      'a[href="/"]'
    );

    expect(back).not.toBeNull();
    expect(back?.textContent?.trim()).toBe('Back to start page');
  });
});
