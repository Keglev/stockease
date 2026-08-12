import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { ApiError } from '../api/api-envelope';
import { errorInterceptor } from './error.interceptor';

const API_URL = `${environment.apiBaseUrl}/api/products`;
const LOGIN_URL = `${environment.apiBaseUrl}/api/auth/login`;

/* Stands in for the real service through DI: the interceptor only ever calls logout on it. */
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

/*
 * Fails a GET against API_URL with the given envelope and status, returning what was thrown.
 * The code is left off the body entirely when not given, which is how most errors arrive.
 */
function failedRequest(status: number, message: string, code?: string): Promise<unknown> {
  const { http, controller } = setUp();
  const thrown = new Promise<unknown>((resolve) => {
    http.get(API_URL).subscribe({ error: (error: unknown) => resolve(error) });
  });

  const body = code === undefined
    ? { success: false, message, data: null }
    : { success: false, message, data: null, code };

  controller.expectOne(API_URL).flush(body, { status, statusText: 'Error' });

  return thrown;
}

/*
 * The error contract every consumer downstream depends on: a failure becomes an ApiError carrying the
 * status, the envelope message and the optional machine code, with a generic fallback when the body
 * carries none. Also the three different 401 cases, which must not all log out.
 * Out of scope: how a component displays the message it is handed.
 */
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

  it('intercept_envelopeWithCode_carriesItOntoTheError', async () => {
    const error = await failedRequest(409, 'Product is deleted.', 'PRODUCT_DELETED');

    // The seam the whole discrimination hangs on: a consumer can only branch on the code if the
    // interceptor lifts it off the envelope, and nothing else in the app reads the raw response.
    expect((error as ApiError).code).toBe('PRODUCT_DELETED');
    expect((error as ApiError).status).toBe(409);
  });

  it('intercept_envelopeWithoutCode_leavesTheCodeUndefined', async () => {
    const error = await failedRequest(409, 'Product is in use.');

    // Absent is the normal case, and it must read as undefined rather than as some placeholder a
    // switch could accidentally match.
    expect((error as ApiError).code).toBeUndefined();
  });

  it('intercept_envelopeWithNonStringCode_leavesTheCodeUndefined', async () => {
    const { http, controller } = setUp();
    const thrown = new Promise<unknown>((resolve) => {
      http.get(API_URL).subscribe({ error: (error: unknown) => resolve(error) });
    });

    // A consumer branching on the code must never be handed something that is not one, whatever a
    // proxy or a future server puts in the field.
    controller.expectOne(API_URL).flush(
      { success: false, message: 'Odd.', data: null, code: 42 },
      { status: 409, statusText: 'Error' }
    );

    expect((await thrown as ApiError).code).toBeUndefined();
  });

  it('intercept_envelopeWithEmptyCode_leavesTheCodeUndefined', async () => {
    const { http, controller } = setUp();
    const thrown = new Promise<unknown>((resolve) => {
      http.get(API_URL).subscribe({ error: (error: unknown) => resolve(error) });
    });

    // An empty string is present but says nothing, and it is the one malformed value that would
    // survive a typed read: it has the declared type, so only the length check rejects it.
    controller.expectOne(API_URL).flush(
      { success: false, message: 'Odd.', data: null, code: '' },
      { status: 409, statusText: 'Error' }
    );

    expect((await thrown as ApiError).code).toBeUndefined();
  });

  it('intercept_bodyThatIsNotAnObject_leavesTheCodeUndefined', async () => {
    const { http, controller } = setUp();
    const thrown = new Promise<unknown>((resolve) => {
      http.get(API_URL).subscribe({ error: (error: unknown) => resolve(error) });
    });

    // A gateway or proxy answers with no envelope at all, and reading a field off that must not
    // throw on the way to the generic failure every consumer already handles.
    controller.expectOne(API_URL).flush(null, { status: 502, statusText: 'Bad Gateway' });

    // Asserting the type as well as the code: reading a field off null throws, and a thrown
    // TypeError has no code either, so the undefined alone would pass for the wrong reason.
    const error = await thrown;
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBeUndefined();
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
