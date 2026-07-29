import { BreakpointObserver } from '@angular/cdk/layout';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatSidenav } from '@angular/material/sidenav';
import { provideRouter, Router } from '@angular/router';

import { AuthService, TOKEN_STORAGE_KEY } from '../../core/auth/auth.service';
import { DEMO_MODE } from '../../core/config/demo-mode';
import { LanguageService } from '../../core/i18n/language.service';
import { BreakpointObserverStub } from '../../testing/breakpoint-testing';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { ShellComponent } from './shell.component';

const TRANSLATIONS = {
  en: {
    common: { appName: 'Bestandskontrolle', language: 'Language' },
    nav: {
      dashboard: 'Overview',
      products: 'Products',
      invoices: 'Invoices',
      movements: 'Stock movements',
      reports: 'Reports',
      suppliers: 'Suppliers',
      customers: 'Customers',
      help: 'Help'
    },
    shell: {
      logout: 'Log out',
      openNavigation: 'Open navigation',
      demoBadge: 'DEMO',
      demoTooltip: 'Demo system - data resets nightly',
      role: { ADMIN: 'Administrator', USER: 'User' }
    }
  },
  de: {
    common: { appName: 'Bestandskontrolle', language: 'Sprache' },
    nav: {
      dashboard: 'Übersicht',
      products: 'Produkte',
      invoices: 'Rechnungen',
      movements: 'Lagerbewegungen',
      reports: 'Berichte',
      suppliers: 'Lieferanten',
      customers: 'Kunden',
      help: 'Hilfe'
    },
    shell: {
      logout: 'Abmelden',
      openNavigation: 'Navigation öffnen',
      role: { ADMIN: 'Administrator', USER: 'Benutzer' }
    }
  }
};

/** Unsigned JWT-shaped token; the frontend only reads the payload. */
function validToken(): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payload = { sub: 'alice', role: 'USER', exp: Math.floor(Date.now() / 1000) + 3600 };
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`;
}

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;
  let breakpoints: BreakpointObserverStub;

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function langButton(label: string): HTMLButtonElement | undefined {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.lang-button')
    ).find((button) => button.textContent?.trim() === label);
  }

  function logoutButton(): HTMLButtonElement | null {
    // Selected by its own class: the toolbar also holds the language and theme toggles.
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button.logout-button'
    );
  }

  function demoBadge(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.demo-badge');
  }

  function navToggle(): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.nav-toggle');
  }

  /** The drawer instance: mode and opened are inputs, so neither reaches the DOM as an attribute. */
  function sidenav(): MatSidenav {
    return fixture.debugElement.query(By.directive(MatSidenav)).componentInstance as MatSidenav;
  }

  function navLink(href: string): HTMLAnchorElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      `mat-nav-list a[href="${href}"]`
    );
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function setUp(demoMode = false, desktop = true): Promise<void> {
    breakpoints = new BreakpointObserverStub(desktop);

    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DEMO_MODE, useValue: demoMode },
        { provide: BreakpointObserver, useValue: breakpoints },
        // Registered so the logout navigation resolves instead of rejecting mid-test.
        provideRouter([
          { path: 'logout', children: [] },
          { path: 'app', children: [] }
        ]),
        provideTestTranslations(TRANSLATIONS)
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('render_defaultLanguage_showsEnglishNavigation', async () => {
    await setUp();

    expect(text()).toContain('Products');
    expect(text()).not.toContain('Produkte');
  });

  it('switchLanguage_deToggleClicked_showsGermanNavigation', async () => {
    await setUp();
    expect(text()).toContain('Products');

    langButton('DE')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(text()).toContain('Produkte');
    expect(text()).toContain('Übersicht');
    expect(text()).toContain('Abmelden');
    expect(text()).not.toContain('Log out');
  });

  it('render_navigationLinks_pointAtAuthenticatedPaths', async () => {
    await setUp();
    const hrefs = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('mat-nav-list a')
    ).map((anchor) => anchor.getAttribute('href'));

    expect(hrefs).toEqual([
      '/app',
      '/app/products',
      '/app/invoices',
      '/app/movements',
      '/app/reports',
      '/app/suppliers',
      '/app/customers',
      // The help entry lives in its own list at the bottom of the drawer, so it comes last.
      '/app/help'
    ]);
  });

  it('render_desktopViewport_sidenavFixedOpenWithoutHamburger', async () => {
    await setUp(false, true);

    expect(sidenav().mode).toBe('side');
    expect(sidenav().opened).toBe(true);
    // Nothing to toggle: the drawer is permanent furniture at this tier.
    expect(navToggle()).toBeNull();
  });

  it('render_handsetViewport_sidenavOverlayClosedWithHamburger', async () => {
    await setUp(false, false);

    expect(sidenav().mode).toBe('over');
    expect(sidenav().opened).toBe(false);
    expect(navToggle()).not.toBeNull();
    expect(navToggle()?.getAttribute('aria-label')).toBe('Open navigation');
  });

  it('toggleSidenav_hamburgerClicked_opensOverlay', async () => {
    await setUp(false, false);
    expect(sidenav().opened).toBe(false);

    navToggle()?.click();
    await settle();

    expect(sidenav().opened).toBe(true);
  });

  it('onNavClick_handsetOverlayOpen_closesSidenav', async () => {
    await setUp(false, false);
    navToggle()?.click();
    await settle();

    navLink('/app')?.click();
    await settle();

    expect(sidenav().opened).toBe(false);
  });

  it('onNavClick_desktopViewport_keepsSidenavOpen', async () => {
    await setUp(false, true);

    navLink('/app')?.click();
    await settle();

    // The drawer covers nothing at this tier, so navigating must not collapse it.
    expect(sidenav().opened).toBe(true);
  });

  it('render_authenticatedShell_showsFooterBelowTheOutlet', async () => {
    await setUp();
    const host = fixture.nativeElement as HTMLElement;

    // The footer belongs to the content pane, not the sidenav, so it must sit inside it.
    expect(host.querySelector('mat-sidenav-content app-footer')).not.toBeNull();
    expect(host.querySelector('mat-sidenav app-footer')).toBeNull();
  });

  it('render_demoFlagEnabled_showsBadgeWithTooltip', async () => {
    await setUp(true);

    expect(demoBadge()?.textContent?.trim()).toBe('DEMO');
    expect(demoBadge()?.getAttribute('title')).toBe('Demo system - data resets nightly');
  });

  it('render_demoFlagDisabled_omitsBadgeEntirely', async () => {
    await setUp(false);

    // The other direction is the point: the badge is a claim about the deployment, so a
    // non-demo build must not carry it at all rather than merely hide it.
    expect(demoBadge()).toBeNull();
    expect(text()).not.toContain('DEMO');
  });

  it('logout_clicked_clearsAuthenticationState', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, validToken());
    await setUp();
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(true);

    logoutButton()?.click();
    await fixture.whenStable();

    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('logout_clicked_navigatesToLogoutPage', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, validToken());
    await setUp();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    logoutButton()?.click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/logout']);
  });
});
