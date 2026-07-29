import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/api/api-envelope';
import { PaginatedProducts, ProductResponse } from '../../core/api/api-models';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiBaseUrl}/api/products`;

  // Quantity is deliberately NOT writable here: no product endpoint accepts a quantity change.
  // Stock only moves through stock movements, so the UI offers no quantity editing either.

  /**
   * Reads one page of products. The paged endpoint is enveloped, so the payload is unwrapped
   * here rather than in an interceptor; the unpaged GET /api/products returns a bare array and
   * must NOT be unwrapped if it is ever added to this service.
   */
  getPagedProducts(page: number, size: number): Observable<PaginatedProducts> {
    const params = new HttpParams().set('page', page).set('size', size);

    return this.http
      .get<ApiEnvelope<PaginatedProducts>>(`${environment.apiBaseUrl}/api/products/paged`, {
        params
      })
      .pipe(map((envelope) => envelope.data as PaginatedProducts));
  }

  /** Bare array - deliberately not unwrapped. */
  getAll(): Observable<ProductResponse[]> {
    return this.http.get<ProductResponse[]>(this.baseUrl);
  }

  /**
   * Lists products at or below the backend's hardcoded low-stock threshold, normalised to an
   * array. As built, the endpoint answers 200 with a bare array when products are low but 200
   * with a bare {"message": "..."} object when none are, so the quirk is absorbed here and
   * components never see two shapes.
   */
  lowStock(): Observable<ProductResponse[]> {
    return this.http
      .get<ProductResponse[] | { message: string }>(`${this.baseUrl}/low-stock`)
      .pipe(map((body) => (Array.isArray(body) ? body : [])));
  }

  /**
   * Bare object - deliberately not unwrapped. No quantity is sent: creation is master-data only
   * and the product starts at zero stock (ADR 018). The SKU is supplied by the operator.
   */
  create(name: string, sku: string, purchasePrice: number): Observable<ProductResponse> {
    return this.http.post<ProductResponse>(this.baseUrl, { name, sku, purchasePrice });
  }

  rename(id: number, name: string): Observable<ProductResponse> {
    return this.http
      .put<ApiEnvelope<ProductResponse>>(`${this.baseUrl}/${id}/name`, { name })
      .pipe(map((envelope) => envelope.data as ProductResponse));
  }

  changePrice(id: number, purchasePrice: number): Observable<ProductResponse> {
    return this.http
      .put<ApiEnvelope<ProductResponse>>(`${this.baseUrl}/${id}/price`, { purchasePrice })
      .pipe(map((envelope) => envelope.data as ProductResponse));
  }

  /** Emits the backend's own message so the caller can surface it verbatim. */
  remove(id: number): Observable<string> {
    return this.http
      .delete<ApiEnvelope<string>>(`${this.baseUrl}/${id}`)
      .pipe(map((envelope) => envelope.message));
  }
}
