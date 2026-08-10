import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  RouterStateSnapshot,
  UrlTree
} from '@angular/router';

import { TOKEN_STORAGE_KEY } from '../auth/auth.service';
import { adminGuard, authGuard } from './auth.guard';

function tokenFor(role: 'ADMIN' | 'USER'): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256' })}.${encode({ sub: 'alice', role, exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;
}

function runGuard(guard: CanActivateFn): boolean | UrlTree {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
  });
  return TestBed.runInInjectionContext(
    () => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
  ) as boolean | UrlTree;
}

/*
 * Who gets through: an authenticated visitor activates, an unauthenticated one is sent to login, and
 * adminGuard sends an authenticated non-admin to the authenticated home rather than to login.
 * Out of scope: how the session is established or expires - auth.service.spec.ts.
 */
describe('auth guards', () => {
  it('authGuard_authenticatedUser_allowsActivation', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, tokenFor('USER'));

    expect(runGuard(authGuard)).toBe(true);
  });

  it('authGuard_unauthenticatedUser_redirectsToLogin', () => {
    const result = runGuard(authGuard);

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login');
  });

  it('adminGuard_userRole_redirectsToAuthenticatedHome', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, tokenFor('USER'));

    const result = runGuard(adminGuard);

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/app');
  });

  it('adminGuard_adminRole_allowsActivation', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, tokenFor('ADMIN'));

    expect(runGuard(adminGuard)).toBe(true);
  });
});
