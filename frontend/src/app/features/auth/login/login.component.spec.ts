import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { LoginComponent } from './login.component';

const LOGIN_URL = `${environment.apiBaseUrl}/api/auth/login`;

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
        provideRouter([]),
        provideTestTranslations({ en: { login: { title: 'Sign in to StockEase' } } })
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

  function fillCredentials(username: string, password: string): void {
    const inputs = (fixture.nativeElement as HTMLElement).querySelectorAll('input');
    inputs[0].value = username;
    inputs[0].dispatchEvent(new Event('input'));
    inputs[1].value = password;
    inputs[1].dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
});
