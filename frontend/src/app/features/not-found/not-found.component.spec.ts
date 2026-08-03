import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { routes } from '../../app.routes';
import { HealthProbe, HealthService } from '../../core/health/health.service';
import { LanguageService } from '../../core/i18n/language.service';
import { provideTestTranslations } from '../../testing/i18n-testing';

const TRANSLATIONS = {
  en: {
    common: { appName: 'Bestandskontrolle', language: 'Language' },
    footer: { tagline: 'Inventory management demo', apiLatency: 'API {{ms}} ms' },
    landing: { loginCta: 'Login' },
    notFound: {
      title: 'Page not found',
      outOfStock: 'This page is out of stock.',
      message: 'The page you were looking for does not exist or has moved.',
      goHome: 'To the start page'
    }
  }
};

/** Keeps the footer's health poll off the network; the real probe has its own spec. */
class HealthServiceStub {
  check() {
    return of<HealthProbe>({ up: true, latencyMs: 12 });
  }
}

/** Host carrying the outlet, so the assertions observe what the real route table renders. */
@Component({ selector: 'app-test-host', imports: [RouterOutlet], template: '<router-outlet />' })
class TestHostComponent {}

describe('NotFoundComponent', () => {
  /** Navigates the real route table to a URL and returns the rendered host element. */
  async function renderRoute(url: string): Promise<HTMLElement> {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideTestTranslations(TRANSLATIONS),
        { provide: HealthService, useValue: new HealthServiceStub() }
      ]
    });
    TestBed.inject(LanguageService).initialize().subscribe();

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('navigate_unknownTopLevelPath_rendersTheNotFoundPage', async () => {
    const host = await renderRoute('/no-such-page');

    expect(host.querySelector('app-not-found')).not.toBeNull();
    expect(host.textContent).toContain('404');
    expect(host.textContent).toContain('Page not found');
  });

  it('navigate_unknownAppChildPath_alsoLandsOnTheNotFoundPage', async () => {
    // The parent /app match is abandoned once no child matches, so the full URL falls through
    // to the wildcard rather than rendering an empty shell.
    const host = await renderRoute('/app/no-such-section');

    expect(host.querySelector('app-not-found')).not.toBeNull();
  });

  it('render_default_showsChromeOutOfStockLineAndBothActions', async () => {
    const host = await renderRoute('/no-such-page');
    const hrefs = Array.from(host.querySelectorAll<HTMLAnchorElement>('.not-found-actions a')).map(
      (anchor) => anchor.getAttribute('href')
    );

    // the public chrome this page was missing: toggles above, footer below
    expect(host.querySelector('app-language-toggle')).not.toBeNull();
    expect(host.querySelector('app-theme-toggle')).not.toBeNull();
    expect(host.querySelector('app-footer')).not.toBeNull();
    expect(host.textContent).toContain('This page is out of stock.');
    // login rather than the dashboard: an unmatched URL says nothing about whether a session exists
    expect(hrefs).toEqual(['/', '/login']);
  });

  it('clickGoHome_fromNotFoundPage_navigatesToTheStartPage', async () => {
    const host = await renderRoute('/no-such-page');

    host.querySelector<HTMLAnchorElement>('.not-found-actions a')?.click();
    await TestBed.inject(Router).navigateByUrl('/');

    expect(TestBed.inject(Router).url).toBe('/');
  });
});
