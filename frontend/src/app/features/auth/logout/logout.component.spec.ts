import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { HealthProbe, HealthService } from '../../../core/health/health.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { LogoutComponent } from './logout.component';

const TRANSLATIONS = {
  en: {
    common: { appName: 'StockEase', language: 'Language' },
    footer: { tagline: 'Inventory management demo', apiLatency: 'API {{ms}} ms' },
    logoutPage: {
      title: 'Logged out',
      message: 'You have been logged out. Thank you for using {{app}}.',
      backToLanding: 'Back to start page',
      loginAgain: 'Log in again'
    }
  },
  de: {
    common: { appName: 'Bestandskontrolle', language: 'Sprache' },
    logoutPage: {
      title: 'Abgemeldet',
      message: 'Sie wurden abgemeldet. Danke, dass Sie {{app}} genutzt haben.',
      backToLanding: 'Zur Startseite',
      loginAgain: 'Erneut anmelden'
    }
  }
};

/** Keeps the footer's health poll off the network; the real probe has its own spec. */
class HealthServiceStub {
  check() {
    return of<HealthProbe>({ up: true, latencyMs: 12 });
  }
}

describe('LogoutComponent', () => {
  let fixture: ComponentFixture<LogoutComponent>;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [LogoutComponent],
      providers: [
        provideRouter([]),
        provideTestTranslations(TRANSLATIONS),
        { provide: HealthService, useValue: new HealthServiceStub() }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(LogoutComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('render_default_showsAcknowledgedMessageWithAppName', () => {
    const host = fixture.nativeElement as HTMLElement;

    // the app name is interpolated, so each language thanks the visitor for its own product name
    expect(host.textContent).toContain('You have been logged out. Thank you for using StockEase.');
    // the confirmation the message alone did not carry
    expect(host.querySelector('.logout-icon')?.textContent?.trim()).toBe('check_circle');
  });

  it('render_default_showsLandingAndLoginActions', () => {
    const host = fixture.nativeElement as HTMLElement;
    const targets = Array.from(host.querySelectorAll<HTMLAnchorElement>('.logout-actions a')).map(
      (link) => link.getAttribute('href')
    );

    // Signing out is as often a switch of user as it is the end of the visit, so both exits exist.
    expect(targets).toEqual(['/', '/login']);
    expect(host.textContent).toContain('Log in again');
  });

  it('render_default_showsFooter', () => {
    const host = fixture.nativeElement as HTMLElement;

    // The public pages carry the same bottom chrome as the authenticated shell.
    expect(host.querySelector('app-footer')).not.toBeNull();
    expect(host.querySelector('app-footer .footer-repository')).not.toBeNull();
  });

  it('render_backAction_pointsAtLandingRoute', () => {
    const back = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      'a[href="/"]'
    );

    expect(back).not.toBeNull();
    expect(back?.textContent?.trim()).toBe('Back to start page');
  });
});
