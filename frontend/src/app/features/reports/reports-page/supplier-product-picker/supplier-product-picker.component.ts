import { Component, input, output, viewChild } from '@angular/core';
import { Observable } from 'rxjs';

import { SupplierProduct, SupplierResponse } from '../../../../core/api/api-models';
import { TypeaheadComponent } from '../../../../shared/typeahead/typeahead.component';

/**
 * The cascading supplier-then-product pair a report tab narrows its product search with.
 *
 * @remarks
 * Presentational. It renders the two fields, announces what was picked in each, and owns the one
 * rule that binds them together: choosing a supplier empties the product field beneath it. What a
 * pick is worth - a refetch, a gate, nothing at all - stays with the tab, whose handlers still
 * decide. The supplier is never a query dimension in either tab that uses this; it decides which
 * products the second field can offer, and nothing else.
 *
 * The product field's disabled state is an input rather than derived here: the tab holds the
 * supplier signal its own search closure reads, so the tab is where "no supplier chosen" is known.
 */
@Component({
  selector: 'app-supplier-product-picker',
  imports: [TypeaheadComponent],
  templateUrl: './supplier-product-picker.component.html',
  styleUrl: './supplier-product-picker.component.scss'
})
export class SupplierProductPickerComponent {
  /** Runs the supplier query; the tab's arrow property, so `this` survives the binding. */
  readonly supplierSearch = input.required<(term: string) => Observable<SupplierResponse[]>>();

  /** Runs the product query, already scoped to the chosen supplier by the tab that owns it. */
  readonly productSearch = input.required<(term: string) => Observable<SupplierProduct[]>>();

  readonly supplierLabel = input.required<(supplier: SupplierResponse) => string>();
  readonly productLabel = input.required<(product: SupplierProduct) => string>();

  readonly productDisabled = input(false);

  readonly supplierSelected = output<SupplierResponse | null>();
  readonly productSelected = output<SupplierProduct | null>();

  // The typeahead owns the text in its field, so clearing the tab's signal alone would leave the
  // previous supplier's product still spelled out in a field that can no longer offer it.
  private readonly productField =
    viewChild<TypeaheadComponent<SupplierProduct>>('productField');

  /**
   * Passes the supplier on and empties the product field under it.
   *
   * <p>The reset emits null through the product field's ordinary path, so `productSelected` carries
   * the clearing out to the tab exactly as a user-cleared field would - one path out, and the tab's
   * existing guard is what decides whether the null is worth acting on.
   */
  protected onSupplier(supplier: SupplierResponse | null): void {
    this.supplierSelected.emit(supplier);
    this.productField()?.reset();
  }
}
