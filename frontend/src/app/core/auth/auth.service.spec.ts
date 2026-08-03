import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../api/api-envelope';
import { AuthService, TOKEN_STORAGE_KEY } from './auth.service';

const LOGIN_URL = `${environment.apiBaseUrl}/api/auth/login`;

const DEMO_LOGIN_URL = `${environment.apiBaseUrl}/api/demo/login`;

/** Builds an unsigned JWT-shaped token; the frontend only reads the payload. */
function tokenWith(payload: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`;
}

function futureToken(role: 'ADMIN' | 'USER' = 'USER'): string {
  return tokenWith({ sub: 'alice', role, exp: Math.floor(Date.now() / 1000) + 3600 });
}

function setUp(): { service: AuthService; http: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()]
  });
  return {
    service: TestBed.inject(AuthService),
    http: TestBed.inject(HttpTestingController)
  };
}

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('login_validCredentials_storesTokenAndSetsState', () => {
    const { service, http } = setUp();
    const token = futureToken('ADMIN');

    service.login('alice', 'secret').subscribe();

    const request = http.expectOne(LOGIN_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ username: 'alice', password: 'secret' });
    request.flush({ success: true, message: 'Login successful', data: token } as ApiEnvelope<string>);

    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe(token);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.role()).toBe('ADMIN');
    http.verify();
  });

  it('login_rejectedCredentials_leavesStateClean', () => {
    const { service, http } = setUp();

    service.login('alice', 'wrong').subscribe({ error: () => undefined });

    http
      .expectOne(LOGIN_URL)
      .flush({ success: false, message: 'Invalid credentials', data: null }, { status: 401, statusText: 'Unauthorized' });

    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.role()).toBeNull();
    http.verify();
  });

  it('demoLogin_adminRole_postsRoleAndStoresTokenLikeNormalLogin', () => {
    const { service, http } = setUp();
    const token = futureToken('ADMIN');

    service.demoLogin('ADMIN').subscribe();

    const request = http.expectOne(DEMO_LOGIN_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ role: 'ADMIN' });
    request.flush({ success: true, message: 'Login successful', data: token } as ApiEnvelope<string>);

    // Same storage key and same signals as login above: after the token lands the two are one session.
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe(token);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.role()).toBe('ADMIN');
    http.verify();
  });

  it('demoLogin_rejectedByBackend_leavesStateClean', () => {
    const { service, http } = setUp();

    service.demoLogin('USER').subscribe({ error: () => undefined });

    http
      .expectOne(DEMO_LOGIN_URL)
      .flush({ success: false, message: 'Demo role must be ADMIN or USER.', data: null }, { status: 400, statusText: 'Bad Request' });

    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    http.verify();
  });

  it('logout_authenticatedSession_clearsTokenAndState', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, futureToken());
    const { service } = setUp();
    expect(service.isAuthenticated()).toBe(true);

    service.logout();

    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.role()).toBeNull();
  });

  it('isAuthenticated_expiredToken_returnsFalse', () => {
    localStorage.setItem(
      TOKEN_STORAGE_KEY,
      tokenWith({ sub: 'alice', role: 'USER', exp: Math.floor(Date.now() / 1000) - 60 })
    );
    const { service } = setUp();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.role()).toBeNull();
  });

  it('isAuthenticated_malformedToken_returnsSafeDefaults', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'not-a-jwt');
    const { service } = setUp();

    expect(() => service.isAuthenticated()).not.toThrow();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.role()).toBeNull();
  });

  it('construct_storedToken_restoresSession', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, futureToken('ADMIN'));
    const { service } = setUp();

    expect(service.isAuthenticated()).toBe(true);
    expect(service.role()).toBe('ADMIN');
  });

  it('username_tokenWithSub_readsIt', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, futureToken());
    const { service } = setUp();

    expect(service.username()).toBe('alice');
  });

  it('loginTime_tokenWithIat_convertsSecondsToADate', () => {
    const issued = Math.floor(Date.UTC(2026, 7, 3, 9, 30) / 1000);
    localStorage.setItem(
      TOKEN_STORAGE_KEY,
      tokenWith({ sub: 'alice', role: 'USER', exp: Math.floor(Date.now() / 1000) + 3600, iat: issued })
    );
    const { service } = setUp();

    // JWT counts seconds, JavaScript milliseconds; the factor of a thousand is the whole method.
    expect(service.loginTime()?.getTime()).toBe(issued * 1000);
  });

  it('sessionFacts_tokenWithoutThoseClaims_areNull', () => {
    localStorage.setItem(
      TOKEN_STORAGE_KEY,
      tokenWith({ role: 'USER', exp: Math.floor(Date.now() / 1000) + 3600 })
    );
    const { service } = setUp();

    // Null rather than a guess: an invented sign-in time is indistinguishable from a real one.
    expect(service.username()).toBeNull();
    expect(service.loginTime()).toBeNull();
  });

  it('sessionFacts_noToken_areNull', () => {
    const { service } = setUp();

    expect(service.username()).toBeNull();
    expect(service.loginTime()).toBeNull();
  });
});
