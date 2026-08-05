import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/api/api-envelope';
import { SupplierResponse } from '../../core/api/api-models';

/** Name and address are the contract; the rest are the optional contact fields V23 added. */
export interface SupplierPayload {
  name: string;
  email?: string;
  phone?: string;
  address: string;
  city?: string;
}

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiBaseUrl}/api/suppliers`;

  // The enveloping below is mixed on purpose: it mirrors the backend contract per endpoint
  // (collection GET and create POST return bare payloads; detail, update and delete are
  // enveloped). This is exactly why unwrapping lives in services and not in an interceptor.

  /** Bare array - deliberately not unwrapped. */
  getAll(): Observable<SupplierResponse[]> {
    return this.http.get<SupplierResponse[]>(this.baseUrl);
  }

  /**
   * Suppliers whose name contains {@code name}, for the typeahead pickers.
   *
   * <p>Bare array, and empty when nothing matches rather than the 204 the older product search
   * answers with - the caller can treat the result as a list unconditionally.
   */
  search(name: string): Observable<SupplierResponse[]> {
    return this.http.get<SupplierResponse[]>(`${this.baseUrl}/search`, {
      params: new HttpParams().set('name', name)
    });
  }

  /** Bare object - deliberately not unwrapped. */
  create(payload: SupplierPayload): Observable<SupplierResponse> {
    return this.http.post<SupplierResponse>(this.baseUrl, compact(payload));
  }

  /**
   * Replaces the supplier wholesale. A blank optional field is dropped rather than sent as an
   * empty string, which is how the backend is asked to clear it - the PUT replaces every field, so
   * an absent one means "remove", not "leave alone".
   */
  update(id: number, payload: SupplierPayload): Observable<SupplierResponse> {
    return this.http
      .put<ApiEnvelope<SupplierResponse>>(`${this.baseUrl}/${id}`, compact(payload))
      .pipe(map((envelope) => envelope.data as SupplierResponse));
  }

  /** Emits the backend's own message so the caller can surface it verbatim. */
  remove(id: number): Observable<string> {
    return this.http
      .delete<ApiEnvelope<string>>(`${this.baseUrl}/${id}`)
      .pipe(map((envelope) => envelope.message));
  }
}

/**
 * Drops blank optional fields so the request carries no empty strings; the backend validates email
 * format when the key is present, and an empty string would fail it. Mirrors the customer service's
 * own compaction, for the same reason.
 */
function compact(payload: SupplierPayload): SupplierPayload {
  const entries = Object.entries(payload).filter(
    ([, value]) => typeof value === 'string' && value.trim().length > 0
  );
  return Object.fromEntries(entries) as unknown as SupplierPayload;
}
