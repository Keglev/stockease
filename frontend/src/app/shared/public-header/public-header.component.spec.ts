import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LanguageService } from '../../core/i18n/language.service';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { PublicHeaderComponent } from './public-header.component';

const TRANSLATIONS = {
  en: { common: { appName: 'StockEase', language: 'Language' } },
  de: { common: { appName: 'Bestandskontrolle', language: 'Sprache' } }
};

/*
 * The header the public pages share: it shows the application name and both toggles, and deliberately
 * carries none of the session chrome the authenticated shell has.
 * Out of scope: the authenticated toolbar - shell.component.spec.ts.
 */
describe('PublicHeaderComponent', () => {
  let fixture: ComponentFixture<PublicHeaderComponent>;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [PublicHeaderComponent],
      providers: [provideRouter([]), provideTestTranslations(TRANSLATIONS)]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(PublicHeaderComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('render_default_showsAppNameAndToggles', () => {
    const host = fixture.nativeElement as HTMLElement;
    const name = host.querySelector<HTMLAnchorElement>('.public-header-name');

    expect(name?.textContent?.trim()).toBe('StockEase');
    expect(name?.getAttribute('href')).toBe('/');
    expect(host.querySelector('app-language-toggle')).not.toBeNull();
    expect(host.querySelector('app-theme-toggle')).not.toBeNull();
  });

  it('render_default_omitsTheSessionChrome', () => {
    const host = fixture.nativeElement as HTMLElement;

    // The badge marks a signed-in demo session, and nothing here is signed in.
    expect(host.querySelector('.demo-badge')).toBeNull();
    expect(host.querySelector('.logout-button')).toBeNull();
  });
});
