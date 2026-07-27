import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { LoginComponent } from './login.component';

const LOGIN_URL = `${environment.apiBaseUrl}/api/auth/login`;

/** Unsigned JWT-shaped token; the frontend only reads the payload. */
function validToken(): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payload = { sub: 'alice', role: 'USER', exp: Math.floor(Date.now() / 1000) + 3600 };
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`;
}

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
        // Registered so the post-login navigation resolves instead of rejecting mid-test.
        provideRouter([{ path: 'app', children: [] }]),
        provideTestTranslations({
          en: {
            common: { appName: 'Bestandskontrolle' },
            login: { title: 'Sign in to {{app}}' }
          }
        })
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    controller = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  it('submit_rejectedCredentials_rendersBackendMessage', async () => {
    fillCredentials('alice', 'wrong');

    (fixture.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(new Event('submit'));

    controller
      .expectOne(LOGIN_URL)
      .flush(
        { success: false, message: 'Invalid username or password.', data: null },
        { status: 401, statusText: 'Unauthorized' }
      );
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Invalid username or password.');
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

  function fillCredentials(username: string, password: string): void {
    const inputs = (fixture.nativeElement as HTMLElement).querySelectorAll('input');
    inputs[0].value = username;
    inputs[0].dispatchEvent(new Event('input'));
    inputs[1].value = password;
    inputs[1].dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
});
