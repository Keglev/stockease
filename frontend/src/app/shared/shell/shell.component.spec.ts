import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService, TOKEN_STORAGE_KEY } from '../../core/auth/auth.service';
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

/** Unsigned JWT-shaped token; the frontend only reads the payload. */
function validToken(): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payload = { sub: 'alice', role: 'USER', exp: Math.floor(Date.now() / 1000) + 3600 };
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`;
}

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

  function logoutButton(): HTMLButtonElement | undefined {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        'mat-toolbar button'
      )
    ).find((button) => !button.classList.contains('lang-button'));
  }

  async function setUp(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
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

    expect(hrefs).toEqual(['/app', '/app/products']);
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
