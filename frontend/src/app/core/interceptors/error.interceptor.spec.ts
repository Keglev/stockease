import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../environments/environment';
import { ApiError, errorInterceptor } from './error.interceptor';

const API_URL = `${environment.apiBaseUrl}/api/products`;

function setUp(): { http: HttpClient; controller: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])),
      provideHttpClientTesting(),
      // The 401 branch navigates, so the router needs somewhere to land.
      provideRouter([{ path: 'login', children: [] }])
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
});
