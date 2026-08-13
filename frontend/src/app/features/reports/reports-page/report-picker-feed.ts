import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';

import { SupplierProduct, SupplierResponse } from '../../../core/api/api-models';
import { SupplierService } from '../../suppliers/supplier.service';
import { ReportService } from '../report.service';

/**
 * The supplier and product typeahead vocabulary the cash-flow and analytics pickers share.
 *
 * @remarks The third collaborator on this page that exists for the same reason as the chart context
 * and the status pair (ADR 039): two tabs read it and neither owns it. The pickers are identical in
 * everything except which supplier signal scopes the product search, so the searches and the labels
 * belong here while each tab keeps only its own scope - splitting it the other way would have put
 * one supplier lookup in two owners, and leaving it on the page would have kept tab vocabulary on a
 * shell that no longer holds any.
 */
@Injectable()
export class ReportPickerFeed {
  private readonly reports = inject(ReportService);
  // The supplier typeaheads read the supplier module's own search; the scoped product search is the
  // reporting module's, so it comes off ReportService above.
  private readonly suppliers = inject(SupplierService);

  /** How a supplier and a product read in the typeahead panels. */
  readonly supplierLabel = (supplier: SupplierResponse): string => supplier.name;
  readonly productLabel = (product: SupplierProduct): string => product.name;

  /** Searches bound into the typeaheads; arrow properties so `this` survives the input binding. */
  readonly searchSuppliers = (term: string): Observable<SupplierResponse[]> =>
    this.suppliers.search(term);

  /** No supplier means no scope to search within, and the field is disabled in that state anyway. */
  searchProductsOf(supplier: SupplierResponse | null, term: string): Observable<SupplierProduct[]> {
    if (supplier?.id == null) {
      return of([]);
    }
    return this.reports.supplierProducts(supplier.id, term);
  }
}
