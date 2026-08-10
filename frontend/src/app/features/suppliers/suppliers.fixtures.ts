import { SupplierResponse } from '../../core/api/api-models';

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
export const ACME: SupplierResponse = {
  id: 7,
  name: 'Acme',
  email: 'acme@example.com',
  phone: '555-1234',
  address: '1 Main St',
  city: 'Springfield',
  createdAt: '2026-01-02T03:04:00'
};
