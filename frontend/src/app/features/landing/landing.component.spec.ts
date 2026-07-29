import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { ApiEnvelope } from '../../core/api/api-envelope';
import { AuthService, UserRole } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { NotificationService } from '../../core/notifications/notification.service';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { LandingComponent } from './landing.component';

/** The rendered result once {{app}} is interpolated from common.appName. */
const DESCRIPTION = 'Bestandskontrolle is an inventory management application for small businesses.';

const TOKEN_ENVELOPE: ApiEnvelope<string> = {
  success: true,
  message: 'Login successful',
  data: 'header.payload.signature'
};

const TRANSLATIONS = {
  en: {
    common: { appName: 'Bestandskontrolle', language: 'Language' },
    landing: {
      description: '{{app}} is an inventory management application for small businesses.',
      demo: {
        title: 'Try the demo',
        tryAdmin: 'Try as Admin',
        tryUser: 'Try as User',
        resetNotice: 'Demo data - resets nightly at 03:00 UTC'
      },
      loginCta: 'Login',
      repository: 'GitHub repository',
      documentation: 'Documentation'
    }
  },
  de: {
    common: { appName: 'Bestandskontrolle', language: 'Sprache' },
    landing: { loginCta: 'Anmelden' }
  }
};

class AuthServiceStub {
  readonly calls: UserRole[] = [];
  result: Observable<ApiEnvelope<string>> = of(TOKEN_ENVELOPE);

  demoLogin(role: UserRole): Observable<ApiEnvelope<string>> {
    this.calls.push(role);
    return this.result;
  }
}

class NotificationServiceStub {
  readonly errors: string[] = [];

  error(message: string): void {
    this.errors.push(message);
  }
}

describe('LandingComponent', () => {
  let fixture: ComponentFixture<LandingComponent>;
  let auth: AuthServiceStub;
  let notifications: NotificationServiceStub;

  function link(href: string): HTMLAnchorElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      `a[href="${href}"]`
    );
  }

  function demoButton(role: 'admin' | 'user'): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      `button.demo-${role}`
    );
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    auth = new AuthServiceStub();
    notifications = new NotificationServiceStub();

    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        // Registered so the post-demo-login navigation resolves instead of rejecting mid-test.
        provideRouter([{ path: 'app', children: [] }]),
        provideTestTranslations(TRANSLATIONS),
        { provide: AuthService, useValue: auth },
        { provide: NotificationService, useValue: notifications }
      ]
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

  it('render_themeToggle_isPresentBeforeLogin', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-theme-toggle')
    ).not.toBeNull();
  });

  it('render_demoBlock_showsBothRolesAndTheResetNotice', () => {
    expect(demoButton('admin')?.textContent?.trim()).toBe('Try as Admin');
    expect(demoButton('user')?.textContent?.trim()).toBe('Try as User');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Demo data - resets nightly at 03:00 UTC'
    );
  });

  it('demoAdmin_clicked_signsInAsAdminAndEntersTheApp', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    demoButton('admin')?.click();
    await fixture.whenStable();

    expect(auth.calls).toEqual(['ADMIN']);
    expect(navigate).toHaveBeenCalledWith(['/app']);
  });

  it('demoUser_clicked_signsInAsUser', async () => {
    demoButton('user')?.click();
    await fixture.whenStable();

    expect(auth.calls).toEqual(['USER']);
  });

  it('demoLogin_rejected_notifiesAndReEnablesBothButtons', async () => {
    auth.result = throwError(() => new Error('Demo mode is off.'));

    demoButton('admin')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(notifications.errors).toEqual(['Demo mode is off.']);
    expect(demoButton('admin')?.disabled).toBe(false);
    expect(demoButton('user')?.disabled).toBe(false);
  });

  it('demoLogin_inFlight_disablesBothButtons', () => {
    // Never completes, so the click leaves the component in its pending state for the assertion.
    auth.result = new Subject<ApiEnvelope<string>>();

    demoButton('admin')?.click();
    fixture.detectChanges();

    expect(demoButton('admin')?.disabled).toBe(true);
    expect(demoButton('user')?.disabled).toBe(true);
  });
});
