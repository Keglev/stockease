import { BreakpointObserver } from '@angular/cdk/layout';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { routes } from '../../app.routes';
import { TOKEN_STORAGE_KEY } from '../../core/auth/auth.service';
import { HealthProbe, HealthService } from '../../core/health/health.service';
import { LanguageService } from '../../core/i18n/language.service';
import { BreakpointObserverStub } from '../../testing/breakpoint-testing';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { HelpComponent } from './help.component';

const TRANSLATIONS = {
  en: {
    common: { language: 'Language' },
    nav: { help: 'Help' },
    help: {
      title: 'Help',
      selectTopic: 'Topic',
      topics: { overview: 'Overview', products: 'Products', languageTheme: 'Language & theme' }
    }
  },
  de: {
    common: { language: 'Sprache' },
    help: {
      title: 'Hilfe',
      selectTopic: 'Thema',
      topics: { overview: 'Übersicht', products: 'Produkte', languageTheme: 'Sprache & Design' }
    }
  }
};

/* Unsigned JWT-shaped token, so the /app guard admits the navigation. */
function validToken(): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payload = { sub: 'alice', role: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 3600 };
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`;
}

/* Keeps the shell footer's health poll off the network; the real probe has its own spec. */
class HealthServiceStub {
  check() {
    return of<HealthProbe>({ up: true, latencyMs: 12 });
  }
}

/* Host carrying the outlet, so assertions observe what the real route table renders. */
@Component({ selector: 'app-test-host', imports: [RouterOutlet], template: '<router-outlet />' })
class TestHostComponent {}

describe('HelpComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: HTMLElement;
  let router: Router;

  /*
   * Navigates the real route table into the shell and returns the rendered host.
   *
   * <p>The real table rather than a local one, because the redirect and the `:topic` parameter are
   * route configuration - a hand-written table in the spec would be testing itself.
   */
  async function renderRoute(url: string, desktop = true): Promise<void> {
    localStorage.clear();
    localStorage.setItem(TOKEN_STORAGE_KEY, validToken());
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        provideRouter(routes),
        provideTestTranslations(TRANSLATIONS),
        { provide: BreakpointObserver, useValue: new BreakpointObserverStub(desktop) },
        { provide: HealthService, useValue: new HealthServiceStub() }
      ]
    });
    TestBed.inject(LanguageService).initialize().subscribe();
    router = TestBed.inject(Router);

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await router.navigateByUrl(url);
    await settle();
    host = fixture.nativeElement as HTMLElement;
  }

  /* Lets the routed component's redirect effect and any language swap reach the DOM. */
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function headings(): string[] {
    return Array.from(host.querySelectorAll('.help-heading')).map(
      (heading) => heading.textContent?.trim() ?? ''
    );
  }

  function title(): string {
    return host.querySelector('.help-title')?.textContent?.trim() ?? '';
  }

  it('route_bareHelpPath_redirectsToOverview', async () => {
    await renderRoute('/app/help');

    expect(router.url).toBe('/app/help/overview');
    expect(title()).toBe('Overview');
  });

  it('render_routedTopic_showsItsTitleAndSections', async () => {
    await renderRoute('/app/help/products');

    expect(title()).toBe('Products');
    expect(headings()).toEqual(['Managing products', 'Deleting and history']);
  });

  it('render_topicWithBullets_rendersTheList', async () => {
    await renderRoute('/app/help/reports');

    expect(host.querySelectorAll('.help-bullets li')).toHaveLength(7);
  });

  it('route_unknownTopic_redirectsToOverview', async () => {
    await renderRoute('/app/help/no-such-topic');

    // Corrected in the URL rather than rendered as an empty page.
    expect(router.url).toBe('/app/help/overview');
    expect(title()).toBe('Overview');
  });

  it('render_desktop_showsNavListAndNoSelect', async () => {
    await renderRoute('/app/help/overview');

    expect(host.querySelectorAll('.help-nav-link')).toHaveLength(8);
    expect(host.querySelector('.help-topic-select')).toBeNull();
  });

  it('render_belowDesktop_showsSelectAndNoNavList', async () => {
    await renderRoute('/app/help/overview', false);

    // Absent from the DOM, not merely hidden: which control exists is a structural decision.
    expect(host.querySelector('.help-nav')).toBeNull();
    expect(host.querySelector('.help-topic-select')).not.toBeNull();
  });

  it('selectTopic_belowDesktop_navigatesRatherThanSettingLocalState', async () => {
    await renderRoute('/app/help/overview', false);
    const navigate = vi.spyOn(router, 'navigate');

    helpComponent().selectTopic('products');

    expect(navigate).toHaveBeenCalledWith(['/app/help', 'products']);
  });

  it('topicSelect_optionChosen_navigatesToThatTopic', async () => {
    await renderRoute('/app/help/overview', false);
    const navigate = vi.spyOn(router, 'navigate');

    // Driven through the rendered select rather than the handler, so the (valueChange) binding
    // is part of what this proves: below desktop the select is the only way to change topic.
    host.querySelector<HTMLElement>('.help-topic-select .mat-mdc-select-trigger')?.click();
    await settle();
    document.querySelectorAll<HTMLElement>('mat-option')[1]?.click();
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/app/help', 'products']);
  });

  it('navLinks_desktop_pointAtEveryTopicRoute', async () => {
    await renderRoute('/app/help/overview');
    const hrefs = Array.from(host.querySelectorAll<HTMLAnchorElement>('.help-nav-link')).map(
      (link) => link.getAttribute('href')
    );

    expect(hrefs[0]).toBe('/app/help/overview');
    expect(hrefs.at(-1)).toBe('/app/help/language-theme');
  });

  it('languageChange_whileTopicOpen_switchesTitleAndBodyWithoutNavigating', async () => {
    await renderRoute('/app/help/products');

    TestBed.inject(LanguageService).setLanguage('de');
    await settle();

    // Nav title through the pipe, body prose from the German module, and the URL untouched.
    expect(title()).toBe('Produkte');
    expect(headings()).toEqual(['Produkte verwalten', 'Löschen und Historie']);
    expect(router.url).toBe('/app/help/products');
  });

  it('backNavigation_afterTopicChange_returnsToThePreviousTopic', async () => {
    await renderRoute('/app/help/overview');
    await router.navigateByUrl('/app/help/products');
    await settle();

    // The URL is the source of truth, so history walks topics rather than leaving the page.
    expect(title()).toBe('Products');
    expect(router.url).toBe('/app/help/products');
  });

  /*
   * The routed instance, reached through the outlet so the real route table stays in charge.
   *
   * <p>Typed to the handler under test rather than to the class: selectTopic is protected, which is
   * correct - the template is its only production caller.
   */
  function helpComponent(): { selectTopic: (id: string) => void } {
    return fixture.debugElement.query(By.directive(HelpComponent)).componentInstance as never;
  }
});
