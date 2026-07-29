import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

const LOGIN_ENDPOINT = `${environment.apiBaseUrl}/api/auth/login`;

const GENERIC_MESSAGE = 'Request failed. Please try again.';

/**
 * An error raised by a failed HTTP call, carrying the status alongside the backend message.
 * It is an Error, so every consumer that only reads {@link Error.message} needs to know nothing
 * about it.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Maps HTTP failures to Errors carrying the backend message, so components can render
 * err.message without knowing about HTTP. A consumer that needs to branch on a known case may
 * check {@code instanceof ApiError} for the status; the message contract is unchanged either way.
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
      return throwError(() => new ApiError(extractMessage(error), status));
    })
  );
};

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
