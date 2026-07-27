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
}

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

  constructor() {
    // Restoring from storage keeps the session alive across a page reload.
    this.tokenSignal.set(this.readStoredToken());
  }

  login(username: string, password: string): Observable<ApiEnvelope<string>> {
    return this.http
      .post<ApiEnvelope<string>>(`${environment.apiBaseUrl}/api/auth/login`, { username, password })
      .pipe(
        tap((response) => {
          if (response.success && response.data) {
            this.storeToken(response.data);
          }
        })
      );
  }

  logout(): void {
    this.clearStoredToken();
    this.tokenSignal.set(null);
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
