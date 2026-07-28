import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/api/api-envelope';
import { InvoiceResponse, InvoiceSummaryResponse } from '../../core/api/api-models';

/**
 * Reads invoices from the API. The list and detail endpoints differ in shape, so each method
 * encodes its own envelope handling.
 */
@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiBaseUrl}/api/invoices`;

  // The enveloping below is mixed on purpose: it mirrors the backend contract per endpoint
  // (the collection GET returns a bare array; the detail GET is enveloped). This is exactly
  // why unwrapping lives in services and not in an interceptor.

  /** Bare array, already ordered newest first by the backend - deliberately not unwrapped. */
  getAll(): Observable<InvoiceSummaryResponse[]> {
    return this.http.get<InvoiceSummaryResponse[]>(this.baseUrl);
  }

  /** Enveloped detail - unwrapped to the payload the components consume. */
  getById(id: number): Observable<InvoiceResponse> {
    return this.http
      .get<ApiEnvelope<InvoiceResponse>>(`${this.baseUrl}/${id}`)
      .pipe(map((envelope) => envelope.data as InvoiceResponse));
  }
}
