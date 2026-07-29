import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { ApiError, errorInterceptor } from './error.interceptor';

const API_URL = `${environment.apiBaseUrl}/api/products`;
const LOGIN_URL = `${environment.apiBaseUrl}/api/auth/login`;

/** Stands in for the real service through DI: the interceptor only ever calls logout on it. */
class AuthServiceStub {
  logoutCalls = 0;

  logout(): void {
    this.logoutCalls++;
  }
}

function setUp(): { http: HttpClient; controller: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])),
      provideHttpClientTesting(),
      // Both routes are registered so a navigation resolves instead of surfacing NG04002 as an
      // unhandled rejection: the 401 branch lands on /login, and /app is where it is redirected from.
      provideRouter([
        { path: 'login', children: [] },
        { path: 'app', children: [] }
      ]),
      { provide: AuthService, useClass: AuthServiceStub }
    ]
  });
  return {
    http: TestBed.inject(HttpClient),
    controller: TestBed.inject(HttpTestingController)
  };
}

/** Fails a GET against API_URL with the given envelope and status, returning what was thrown. */
function failedRequest(status: number, message: string): Promise<unknown> {
  const { http, controller } = setUp();
  const thrown = new Promise<unknown>((resolve) => {
    http.get(API_URL).subscribe({ error: (error: unknown) => resolve(error) });
  });

  controller
    .expectOne(API_URL)
    .flush({ success: false, message, data: null }, { status, statusText: 'Error' });

  return thrown;
}

describe('errorInterceptor', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('intercept_failedResponse_throwsApiErrorCarryingTheStatus', async () => {
    const error = await failedRequest(409, 'Product is in use.');

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
  });

  it('intercept_failedResponse_keepsTheEnvelopeMessageOnTheError', async () => {
    const error = await failedRequest(409, 'Product is in use.');

    // The message contract is what every consumer reads; carrying the status must not disturb it.
    expect((error as Error).message).toBe('Product is in use.');
    expect(error).toBeInstanceOf(Error);
  });

  it('intercept_bodyWithoutMessage_fallsBackToTheGenericMessage', async () => {
    const { http, controller } = setUp();
    const thrown = new Promise<unknown>((resolve) => {
      http.get(API_URL).subscribe({ error: (error: unknown) => resolve(error) });
    });

    controller.expectOne(API_URL).flush(null, { status: 500, statusText: 'Server Error' });

    expect(((await thrown) as Error).message).toBe('Request failed. Please try again.');
  });

  it('intercept_unauthorizedOutsideLogin_logsOutAndRedirectsWithExpiredReason', async () => {
    const { http, controller } = setUp();
    const auth = TestBed.inject(AuthService) as unknown as AuthServiceStub;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    const thrown = new Promise<unknown>((resolve) => {
      http.get(API_URL).subscribe({ error: (error: unknown) => resolve(error) });
    });

    controller.expectOne(API_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
    await thrown;

    expect(auth.logoutCalls).toBe(1);
    // whole-object pin: the reason drives the login notice and replaceUrl keeps the dead deep
    // link out of history, so both are part of the contract, not incidental options
    expect(navigate.mock.calls).toEqual([
      [['/login'], { queryParams: { reason: 'expired' }, replaceUrl: true }]
    ]);
  });

  it('intercept_unauthorizedWhileAlreadyOnLogin_doesNotNavigateAgain', async () => {
    const { http, controller } = setUp();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/login?reason=expired');
    const navigate = vi.spyOn(router, 'navigate');
    const thrown = new Promise<unknown>((resolve) => {
      http.get(API_URL).subscribe({ error: (error: unknown) => resolve(error) });
    });

    controller.expectOne(API_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
    await thrown;

    // the vacuity guard: N parallel 401s from one page must not queue N navigations to the page
    // they are already on, which is what a redirect loop looks like from the user's side
    expect(navigate).not.toHaveBeenCalled();
  });

  it('intercept_unauthorizedFromLoginEndpoint_neitherLogsOutNorRedirects', async () => {
    const { http, controller } = setUp();
    const auth = TestBed.inject(AuthService) as unknown as AuthServiceStub;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    const thrown = new Promise<unknown>((resolve) => {
      http.post(LOGIN_URL, {}).subscribe({ error: (error: unknown) => resolve(error) });
    });

    controller.expectOne(LOGIN_URL).flush(null, { status: 401, statusText: 'Unauthorized' });

    // a rejected login is the user's own failed attempt: the page keeps it and shows a message
    expect((await thrown) as ApiError).toBeInstanceOf(ApiError);
    expect(auth.logoutCalls).toBe(0);
    expect(navigate).not.toHaveBeenCalled();
  });
});
