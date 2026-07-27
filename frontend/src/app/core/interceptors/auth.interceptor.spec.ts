import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { TOKEN_STORAGE_KEY } from '../auth/auth.service';
import { authInterceptor } from './auth.interceptor';

const API_URL = `${environment.apiBaseUrl}/api/products`;

const EXTERNAL_URL = 'https://third-party.example.com/data';

function validToken(): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256' })}.${encode({ sub: 'alice', role: 'USER', exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;
}

function setUp(): { http: HttpClient; controller: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()]
  });
  return {
    http: TestBed.inject(HttpClient),
    controller: TestBed.inject(HttpTestingController)
  };
}

describe('authInterceptor', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('intercept_apiUrlWithToken_addsAuthorizationHeader', () => {
    const token = validToken();
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    const { http, controller } = setUp();

    http.get(API_URL).subscribe();

    const request = controller.expectOne(API_URL);
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    request.flush({});
    controller.verify();
  });

  it('intercept_nonApiUrlWithToken_leavesRequestUntouched', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, validToken());
    const { http, controller } = setUp();

    http.get(EXTERNAL_URL).subscribe();

    const request = controller.expectOne(EXTERNAL_URL);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
    controller.verify();
  });

  it('intercept_apiUrlWithoutToken_leavesRequestUntouched', () => {
    const { http, controller } = setUp();

    http.get(API_URL).subscribe();

    const request = controller.expectOne(API_URL);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
    controller.verify();
  });
});
