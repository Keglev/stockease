import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../api/api-envelope';
import { AuthService } from '../auth/auth.service';

const LOGIN_ENDPOINT = `${environment.apiBaseUrl}/api/auth/login`;

const GENERIC_MESSAGE = 'Request failed. Please try again.';

/**
 * Maps HTTP failures to Errors carrying the backend message, so components can render
 * err.message without knowing about HTTP. A consumer that needs to branch on a known case may
 * check `instanceof ApiError` for the status; the message contract is unchanged either way.
 * Successful bodies pass through untouched because the report endpoints are not enveloped.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;
      // Excluding the login endpoint prevents a redirect loop on a rejected login attempt.
      if (isUnauthorized && !req.url.startsWith(LOGIN_ENDPOINT)) {
        auth.logout();
        // Already-on-/login check, not a flag: a page firing several requests answers with several
        // 401s, and each one would otherwise queue its own navigation to the page we are on.
        // replaceUrl keeps the dead deep link out of history, so Back does not return to it.
        if (!router.url.startsWith('/login')) {
          void router.navigate(['/login'], {
            queryParams: { reason: 'expired' },
            replaceUrl: true
          });
        }
      }
      // Status 0 stands for "never reached the server": a network or CORS failure carries no
      // HTTP status, so no consumer can mistake it for one the backend chose.
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      return throwError(() => new ApiError(extractMessage(error), status, extractCode(error)));
    })
  );
};

/**
 * Reads the envelope's optional error code. Absent is the normal case and yields undefined, which
 * is also what a malformed or non-string value yields - a consumer branching on the code must not
 * be handed something that is not one.
 */
function extractCode(error: unknown): string | undefined {
  if (!(error instanceof HttpErrorResponse)) {
    return undefined;
  }
  const body: unknown = error.error;
  if (body !== null && typeof body === 'object' && 'code' in body) {
    const code = (body as { code: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
  }
  return undefined;
}

function extractMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return GENERIC_MESSAGE;
  }
  const body: unknown = error.error;
  if (body !== null && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return GENERIC_MESSAGE;
}
