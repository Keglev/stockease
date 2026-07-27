import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

const LOGIN_ENDPOINT = `${environment.apiBaseUrl}/api/auth/login`;

const GENERIC_MESSAGE = 'Request failed. Please try again.';

/**
 * Maps HTTP failures to plain Errors carrying the backend message, so components can render
 * err.message without knowing about HTTP. Successful bodies pass through untouched because
 * the report endpoints are not enveloped.
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
        void router.navigate(['/login']);
      }
      return throwError(() => new Error(extractMessage(error)));
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
