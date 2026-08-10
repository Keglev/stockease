import { ProductResponse } from '../../core/api/api-models';

/*
 * Response fixtures shared by this feature's specs, held here under the shared-fixture rule
 * because two or more spec files consume them. A fixture stays in its own spec file until a
 * second file needs the identical value.
 *
 * Constants and pure builder functions only. No beforeEach, afterEach, or any other hook
 * registration belongs in this file: hooks registered outside a describe block have been
 * observed not to run for every spec under coverage, so a hook placed here would silently
 * protect nothing.
 */
export const WIDGET: ProductResponse = {
  id: 3,
  name: 'Widget',
  sku: 'SKU-3',
  quantity: 2,
  purchasePrice: 15,
  totalValue: 30,
  createdAt: '2026-01-02T03:04:00'
};
