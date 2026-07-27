import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/api/api-envelope';
import { CustomerResponse } from '../../core/api/api-models';

export interface CreateCustomerPayload {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiBaseUrl}/api/customers`;

  // There is deliberately NO update method: the backend exposes no customer PUT endpoint,
  // by design rather than by omission, so the UI offers no edit affordance either.
  // The enveloping below mirrors the backend per endpoint: the collection GET and the
  // create POST return bare payloads, while delete is enveloped.

  /** Bare array - deliberately not unwrapped. */
  getAll(): Observable<CustomerResponse[]> {
    return this.http.get<CustomerResponse[]>(this.baseUrl);
  }

  /** Bare object - deliberately not unwrapped. */
  create(payload: CreateCustomerPayload): Observable<CustomerResponse> {
    return this.http.post<CustomerResponse>(this.baseUrl, compact(payload));
  }

  /** Emits the backend's own message so the caller can surface it verbatim. */
  remove(id: number): Observable<string> {
    return this.http
      .delete<ApiEnvelope<string>>(`${this.baseUrl}/${id}`)
      .pipe(map((envelope) => envelope.message));
  }
}

/**
 * Drops blank optional fields so the request carries no empty strings; the backend
 * validates email format when the key is present, and an empty string would fail it.
 */
function compact(payload: CreateCustomerPayload): CreateCustomerPayload {
  const entries = Object.entries(payload).filter(
    ([, value]) => typeof value === 'string' && value.trim().length > 0
  );
  return Object.fromEntries(entries) as unknown as CreateCustomerPayload;
}
