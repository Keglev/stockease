import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ChangeLogEntryResponse, ChangeLogResponse } from '../../core/api/api-models';

/**
 * Reads the product change log from the two audit endpoints, which differ only in what they
 * select by. Both are open to either role: the audit trail is transparency rather than
 * administration, and the backend's own hasAnyRole says so.
 */
@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiBaseUrl}/api/audit`;

  /** Bare array, newest first as the backend orders it - deliberately neither unwrapped nor re-sorted. */
  productChanges(productId: number): Observable<ChangeLogResponse[]> {
    return this.http.get<ChangeLogResponse[]>(`${this.baseUrl}/products/${productId}/changes`);
  }

  /** Bare array, newest first as the backend orders it - deliberately neither unwrapped nor re-sorted. */
  userChanges(userId: number): Observable<ChangeLogResponse[]> {
    return this.http.get<ChangeLogResponse[]>(`${this.baseUrl}/users/${userId}/changes`);
  }

  /**
   * Reads recent changes across every product, enriched with the username and the product's identity.
   *
   * <p>A different row type from the two lookups above, because it answers a different question:
   * those select by an ID the caller already holds, while this one has to say whose change and to
   * what. Omitted bounds are left off the request entirely, as on every other period endpoint.
   *
   * @param from first change date to include, as an ISO date
   * @param to last change date to include, as an ISO date
   */
  changes(from?: string, to?: string): Observable<ChangeLogEntryResponse[]> {
    let params = new HttpParams();
    if (from) {
      params = params.set('from', from);
    }
    if (to) {
      params = params.set('to', to);
    }
    return this.http.get<ChangeLogEntryResponse[]>(`${this.baseUrl}/changes`, { params });
  }
}
