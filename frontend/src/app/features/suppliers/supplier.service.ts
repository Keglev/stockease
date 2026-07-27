import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/api/api-envelope';
import { SupplierResponse } from '../../core/api/api-models';

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

  /** Bare object - deliberately not unwrapped. */
  create(name: string, address: string): Observable<SupplierResponse> {
    return this.http.post<SupplierResponse>(this.baseUrl, { name, address });
  }

  update(id: number, name: string, address: string): Observable<SupplierResponse> {
    return this.http
      .put<ApiEnvelope<SupplierResponse>>(`${this.baseUrl}/${id}`, { name, address })
      .pipe(map((envelope) => envelope.data as SupplierResponse));
  }

  /** Emits the backend's own message so the caller can surface it verbatim. */
  remove(id: number): Observable<string> {
    return this.http
      .delete<ApiEnvelope<string>>(`${this.baseUrl}/${id}`)
      .pipe(map((envelope) => envelope.message));
  }
}
