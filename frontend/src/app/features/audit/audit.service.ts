import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ChangeLogResponse } from '../../core/api/api-models';

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
}
