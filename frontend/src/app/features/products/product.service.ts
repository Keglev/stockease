import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/api/api-envelope';
import { PaginatedProducts } from '../../core/api/api-models';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

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
}
