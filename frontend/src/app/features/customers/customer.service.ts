import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/api/api-envelope';
import { CustomerResponse } from '../../core/api/api-models';

/** Name is the contract; the rest are optional. One shape for create and for replace. */
export interface CustomerPayload {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
}

/**
 * Reads and writes the customer register.
 *
 * @remarks
 * The envelope handling is mixed on purpose, endpoint by endpoint: the collection read and the
 * create return bare payloads, while update and delete are enveloped. That is the backend's
 * contract rather than an inconsistency to smooth over, and it is the reason unwrapping lives in
 * this service instead of an interceptor, which would have to guess which shape it was holding.
 */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiBaseUrl}/api/customers`;

  // The enveloping below is mixed on purpose: it mirrors the backend contract per endpoint
  // (collection GET and create POST return bare payloads; update and delete are enveloped).
  // This is exactly why unwrapping lives in services and not in an interceptor.

  /** Bare array - deliberately not unwrapped. */
  getAll(): Observable<CustomerResponse[]> {
    return this.http.get<CustomerResponse[]>(this.baseUrl);
  }

  /** Bare object - deliberately not unwrapped. */
  create(payload: CustomerPayload): Observable<CustomerResponse> {
    return this.http.post<CustomerResponse>(this.baseUrl, compact(payload));
  }

  /**
   * Replaces the customer wholesale. A blank optional field is dropped rather than sent as an
   * empty string, which is how the backend is asked to clear it - the PUT replaces every field, so
   * an absent one means "remove", not "leave alone".
   */
  update(id: number, payload: CustomerPayload): Observable<CustomerResponse> {
    return this.http
      .put<ApiEnvelope<CustomerResponse>>(`${this.baseUrl}/${id}`, compact(payload))
      .pipe(map((envelope) => envelope.data as CustomerResponse));
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
function compact(payload: CustomerPayload): CustomerPayload {
  const entries = Object.entries(payload).filter(
    ([, value]) => typeof value === 'string' && value.trim().length > 0
  );
  return Object.fromEntries(entries) as unknown as CustomerPayload;
}
