import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/api/api-envelope';
import {
  CreateInvoiceRequest,
  InvoiceResponse,
  InvoiceSummaryResponse,
  PaginatedInvoices
} from '../../core/api/api-models';

/**
 * Reads invoices from the API. The list and detail endpoints differ in shape, so each method
 * encodes its own envelope handling.
 */
@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiBaseUrl}/api/invoices`;

  // The enveloping below is mixed on purpose: it mirrors the backend contract per endpoint
  // (the paged GET and the detail GET are enveloped; creation returns the bare record). This is
  // exactly why unwrapping lives in services and not in an interceptor.

  /**
   * Reads one page of the ledger, newest first. Enveloped, because the page metadata travels in
   * the envelope. The backend also serves an unpaged `GET /api/invoices`, which this client does
   * not call: the list has been paged since #119, so no consumer here wants the whole ledger.
   *
   * @param page zero-based page index
   * @param size items per page
   */
  getPagedInvoices(page: number, size: number): Observable<PaginatedInvoices> {
    const params = new HttpParams().set('page', page).set('size', size);

    return this.http
      .get<ApiEnvelope<PaginatedInvoices>>(`${this.baseUrl}/paged`, { params })
      .pipe(map((envelope) => envelope.data as PaginatedInvoices));
  }

  /** Enveloped detail - unwrapped to the payload the components consume. */
  getById(id: number): Observable<InvoiceResponse> {
    return this.http
      .get<ApiEnvelope<InvoiceResponse>>(`${this.baseUrl}/${id}`)
      .pipe(map((envelope) => envelope.data as InvoiceResponse));
  }

  /** Bare created summary - deliberately not unwrapped. */
  create(request: CreateInvoiceRequest): Observable<InvoiceSummaryResponse> {
    return this.http.post<InvoiceSummaryResponse>(this.baseUrl, request);
  }

  /** Enveloped - books the stock movements server-side and returns the updated summary. */
  close(id: number): Observable<InvoiceSummaryResponse> {
    return this.http
      .patch<ApiEnvelope<InvoiceSummaryResponse>>(`${this.baseUrl}/${id}/close`, {})
      .pipe(map((envelope) => envelope.data as InvoiceSummaryResponse));
  }

  /** Enveloped - records the payment timestamp and returns the updated summary. */
  markPaid(id: number): Observable<InvoiceSummaryResponse> {
    return this.http
      .patch<ApiEnvelope<InvoiceSummaryResponse>>(`${this.baseUrl}/${id}/paid`, {})
      .pipe(map((envelope) => envelope.data as InvoiceSummaryResponse));
  }

  /** Emits the backend's own message so the caller can surface it verbatim. */
  remove(id: number): Observable<string> {
    return this.http
      .delete<ApiEnvelope<string>>(`${this.baseUrl}/${id}`)
      .pipe(map((envelope) => envelope.message));
  }
}
