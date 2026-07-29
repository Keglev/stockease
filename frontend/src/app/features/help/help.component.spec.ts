import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LanguageService } from '../../core/i18n/language.service';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { HelpComponent } from './help.component';

const TRANSLATIONS = {
  en: {
    common: { language: 'Language' },
    help: { title: 'Help' }
  },
  de: {
    common: { language: 'Sprache' },
    help: { title: 'Hilfe' }
  }
};

describe('HelpComponent', () => {
  let fixture: ComponentFixture<HelpComponent>;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [HelpComponent],
      providers: [provideTestTranslations(TRANSLATIONS)]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(HelpComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('render_default_showsTranslatedTitle', () => {
    const title = (fixture.nativeElement as HTMLElement).querySelector('h1');

    expect(title?.textContent?.trim()).toBe('Help');
  });
});
