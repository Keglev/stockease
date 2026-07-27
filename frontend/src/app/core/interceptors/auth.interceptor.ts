import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/** Attaches the bearer token to backend requests only, so third-party URLs never see it. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();

  let outgoing = req;
  if (token && req.url.startsWith(environment.apiBaseUrl)) {
    outgoing = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(outgoing);
};
