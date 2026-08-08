import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../api/api-envelope';

export type UserRole = 'ADMIN' | 'USER';

export const TOKEN_STORAGE_KEY = 'stockease.token';

/** Claims the backend puts in the JWT; all optional because the token is untrusted input. */
interface JwtPayload {
  sub?: string;
  role?: string;
  exp?: number;
  /** Issued-at, seconds since the epoch; the backend has always set it, nothing read it until now. */
  iat?: number;
}

/**
 * Holds the session token and answers who the current reader is.
 *
 * @remarks
 * Every question about the session is derived from the token rather than tracked beside it:
 * whether a session exists is the `exp` claim read against the clock, and the role is the `role`
 * claim. There is nothing to ask the server, because the token is the whole session (ADR 036).
 *
 * The claims are typed optional because a token read back from storage is untrusted input - it
 * may be absent, truncated, or issued by a version that spelled things differently - so every
 * read has to survive a payload that does not carry what it should.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly tokenSignal = signal<string | null>(null);

  /** Raw bearer token; the auth interceptor reads it to build the Authorization header. */
  readonly token = this.tokenSignal.asReadonly();

  private readonly payload = computed(() => this.decodePayload(this.tokenSignal()));

  readonly isAuthenticated = computed(() => {
    const exp = this.payload()?.exp;
    return typeof exp === 'number' && exp * 1000 > Date.now();
  });

  readonly role = computed<UserRole | null>(() => {
    if (!this.isAuthenticated()) {
      return null;
    }
    const role = this.payload()?.role;
    return role === 'ADMIN' || role === 'USER' ? role : null;
  });

  /**
   * Who the token says is signed in, for display only.
   *
   * <p>Not gated on {@link isAuthenticated}, unlike {@link role}: that one guards what the UI
   * offers, so an expired token must answer null. This one only labels a settings row.
   */
  readonly username = computed<string | null>(() => this.payload()?.sub ?? null);

  /**
   * When this session began, from the token's `iat` claim.
   *
   * <p>Null when the claim is missing rather than falling back to "now": a made-up sign-in time
   * would look exactly like a real one, and the settings row shows an em dash instead.
   */
  readonly loginTime = computed<Date | null>(() => {
    const iat = this.payload()?.iat;
    return typeof iat === 'number' ? new Date(iat * 1000) : null;
  });

  constructor() {
    // Restoring from storage keeps the session alive across a page reload.
    this.tokenSignal.set(this.readStoredToken());
  }

  login(username: string, password: string): Observable<ApiEnvelope<string>> {
    return this.authenticate(`${environment.apiBaseUrl}/api/auth/login`, { username, password });
  }

  /** Passwordless demo entry: the backend issues an ordinary JWT for the demo account of that role. */
  demoLogin(role: UserRole): Observable<ApiEnvelope<string>> {
    return this.authenticate(`${environment.apiBaseUrl}/api/demo/login`, { role });
  }

  logout(): void {
    this.clearStoredToken();
    this.tokenSignal.set(null);
  }

  /**
   * Posts a credential-bearing body and captures the token the envelope carries. Both logins go
   * through here on purpose: once the token lands, a demo session is indistinguishable from a
   * normal one - same storage key, same signals, same restore on reload - so no downstream code
   * has a demo branch to get wrong.
   */
  private authenticate(url: string, body: object): Observable<ApiEnvelope<string>> {
    return this.http.post<ApiEnvelope<string>>(url, body).pipe(
      tap((response) => {
        if (response.success && response.data) {
          this.storeToken(response.data);
        }
      })
    );
  }

  private storeToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // Storage can be unavailable (private mode, disabled cookies); the in-memory
      // session below still works for the current page.
    }
    this.tokenSignal.set(token);
  }

  private readStoredToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private clearStoredToken(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Nothing to clean up when storage is unavailable.
    }
  }

  private decodePayload(token: string | null): JwtPayload | null {
    if (!token) {
      return null;
    }
    try {
      const segment = token.split('.')[1];
      if (!segment) {
        return null;
      }
      const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      const parsed: unknown = JSON.parse(atob(padded));
      return typeof parsed === 'object' && parsed !== null ? (parsed as JwtPayload) : null;
    } catch {
      return null;
    }
  }
}
