import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { HealthProbe, HealthService } from '../../../core/health/health.service';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { LoginComponent } from './login.component';

const LOGIN_URL = `${environment.apiBaseUrl}/api/auth/login`;

/* Unsigned JWT-shaped token; the frontend only reads the payload. */
function validToken(): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payload = { sub: 'alice', role: 'USER', exp: Math.floor(Date.now() / 1000) + 3600 };
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`;
}

/* Keeps the footer's health poll off the HTTP testing backend, where it would fail verify(). */
class HealthServiceStub {
  check() {
    return of<HealthProbe>({ up: true, latencyMs: 12 });
  }
}

/*
 * The credential form: a rejected sign-in shows the translated message while a server error shows the
 * backend's own sentence, and a valid one navigates into the application. Also the password toggle,
 * which must not submit the form, and the expired-session notice.
 * Out of scope: the token handling behind a successful login - auth.service.spec.ts.
 */
describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let controller: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: HealthService, useValue: new HealthServiceStub() },
        // Registered so the post-login navigation resolves instead of rejecting mid-test.
        provideRouter([{ path: 'app', children: [] }]),
        provideTestTranslations({
          en: {
            common: {
              appName: 'StockEase',
              errors: {
                validationFailed: 'Validation failed. Please check your entries.',
                serverError: 'A server error occurred. Please try again later.'
              }
            },
            footer: { tagline: 'Inventory management demo', apiLatency: 'API {{ms}} ms' },
            login: {
              title: 'Sign in to {{app}}',
              showPassword: 'Show password',
              hidePassword: 'Hide password',
              invalidCredentials: 'Invalid username or password',
              sessionExpired: 'Your session has expired. Please log in again.',
              backToLanding: 'Back to start page'
            }
          }
        })
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    controller = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  it('render_default_showsBackToLandingLink', () => {
    const back = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.login-back-link'
    );

    // The way out for a visitor who came here but wanted the demo buttons.
    expect(back?.getAttribute('href')).toBe('/');
    expect(back?.textContent).toContain('Back to start page');
  });

  it('render_default_showsFooter', () => {
    const host = fixture.nativeElement as HTMLElement;

    // The public pages carry the same bottom chrome as the authenticated shell.
    expect(host.querySelector('app-footer')).not.toBeNull();
    expect(host.querySelector('app-footer .footer-repository')).not.toBeNull();
  });

  it('submit_rejectedCredentials_rendersTranslatedMessageNotTheBackendText', async () => {
    fillCredentials('alice', 'wrong');
    submitForm();

    // A distinctive backend message, so the assertion proves the translation replaced it rather
    // than merely happening to read the same.
    await failWith(401, 'Bad credentials from the server.');

    expect(text()).toContain('Invalid username or password');
    expect(text()).not.toContain('Bad credentials from the server.');
    controller.verify();
  });

  it('submit_serverError_rendersTheCatalogSentenceNotTheBackendText', async () => {
    // A 5xx the API did not name now reads as the application's own generic sentence rather than
    // as the server's prose about itself. The wire sentence below and the catalog one share the
    // words 'error occurred', so containment of the catalog sentence alone would not prove
    // replacement; the pair of assertions - catalog present, wire absent - is what carries the
    // proof.
    fillCredentials('alice', 'secret');
    submitForm();

    await failWith(500, 'An unexpected error occurred.');

    expect(text()).toContain('A server error occurred. Please try again later.');
    expect(text()).not.toContain('An unexpected error occurred.');
    controller.verify();
  });

  it('submit_validationFailed_rendersTheCatalogSentenceNotTheBackendText', async () => {
    // The login body is validated, so a credential the client let through comes back coded. The
    // catalog sentence and the wire sentence differ word for word, so this passes only if the
    // resolver actually replaced one with the other.
    fillCredentials('alice', 'secret');
    submitForm();

    await failWith(400, 'Validation failed for request parameters.', 'VALIDATION_FAILED');

    expect(text()).toContain('Validation failed. Please check your entries.');
    expect(text()).not.toContain('Validation failed for request parameters.');
    controller.verify();
  });

  it('togglePassword_clicked_flipsTheInputTypeAndAriaPressed', () => {
    const input = passwordInput();
    expect(input.getAttribute('type')).toBe('password');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');

    toggle().click();
    fixture.detectChanges();

    expect(passwordInput().getAttribute('type')).toBe('text');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(toggle().getAttribute('title')).toBe('Hide password');
  });

  it('togglePassword_clicked_doesNotSubmitTheForm', () => {
    fillCredentials('alice', 'secret');

    toggle().click();
    fixture.detectChanges();

    // type="button" is what keeps this true; the default inside a form would post it.
    controller.expectNone(LOGIN_URL);
    controller.verify();
  });

  it('submit_validCredentials_navigatesToAuthenticatedArea', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    fillCredentials('alice', 'secret');

    (fixture.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(new Event('submit'));

    controller.expectOne(LOGIN_URL).flush({ success: true, message: 'ok', data: validToken() });
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/app']);
    controller.verify();
  });

  it('submit_requestInFlight_showsASpinnerInTheButtonUntilTheResponseArrives', async () => {
    const spinner = () => (fixture.nativeElement as HTMLElement).querySelector('mat-spinner');
    fillCredentials('alice', 'secret');

    // Nothing in flight yet, so the reserved slot is empty.
    expect(spinner()).toBeNull();

    submitForm();
    fixture.detectChanges();

    // The request is open and unanswered at this point: this is the window the spinner exists for,
    // and the only one in which the assertion means anything.
    const request = controller.expectOne(LOGIN_URL);
    expect(spinner()).not.toBeNull();

    request.flush({ success: true, message: 'ok', data: validToken() });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(spinner()).toBeNull();
    controller.verify();
  });

  it('render_default_showsTheSharedPublicHeaderInsteadOfFloatingToggles', () => {
    const host = fixture.nativeElement as HTMLElement;

    // The toggles used to float in the page's top-right corner with nothing naming the product.
    expect(host.querySelector('.login-page-header')).toBeNull();
    expect(host.querySelector('app-public-header app-language-toggle')).not.toBeNull();
    expect(host.querySelector('app-public-header app-theme-toggle')).not.toBeNull();
  });

  it('render_withoutExpiredReason_showsNoSessionNotice', () => {
    // the other direction of the pin: an ordinary visit to /login explains nothing it should not
    expect((fixture.nativeElement as HTMLElement).querySelector('.login-notice')).toBeNull();
    expect(text()).not.toContain('Your session has expired.');
  });

  it('render_expiredReason_showsSessionExpiredNotice', async () => {
    await withQueryParams({ reason: 'expired' });

    expect(text()).toContain('Your session has expired. Please log in again.');
    // it is an explanation, not the visitor's failed attempt, so it is not the error line
    expect((fixture.nativeElement as HTMLElement).querySelector('.login-error')).toBeNull();
  });

  /* Rebuilds the component with the given query params supplied through the ActivatedRoute seam. */
  async function withQueryParams(params: Record<string, string>): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: HealthService, useValue: new HealthServiceStub() },
        provideRouter([{ path: 'app', children: [] }]),
        provideTestTranslations({
          en: {
            common: { appName: 'StockEase' },
            footer: { tagline: 'Inventory management demo', apiLatency: 'API {{ms}} ms' },
            login: {
              title: 'Sign in to {{app}}',
              showPassword: 'Show password',
              hidePassword: 'Hide password',
              invalidCredentials: 'Invalid username or password',
              sessionExpired: 'Your session has expired. Please log in again.'
            }
          }
        }),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(params) } }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    controller = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function passwordInput(): HTMLInputElement {
    return (fixture.nativeElement as HTMLElement).querySelectorAll('input')[1];
  }

  function toggle(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button.password-toggle'
    )!;
  }

  function submitForm(): void {
    (fixture.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(new Event('submit'));
  }

  /*
   * Fails the pending login with the given status and backend message, then settles the view.
   * The code is optional because most refusals here carry none - a 401 and a 500 are uncoded -
   * and an absent one has to reach the component absent rather than as an empty string.
   */
  async function failWith(status: number, message: string, code?: string): Promise<void> {
    controller
      .expectOne(LOGIN_URL)
      .flush({ success: false, message, data: null, code }, { status, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function fillCredentials(username: string, password: string): void {
    const inputs = (fixture.nativeElement as HTMLElement).querySelectorAll('input');
    inputs[0].value = username;
    inputs[0].dispatchEvent(new Event('input'));
    inputs[1].value = password;
    inputs[1].dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
});
