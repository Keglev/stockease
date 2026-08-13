import { Observable, of } from 'rxjs';

import {
  CreateInvoiceRequest,
  CustomerResponse,
  InvoiceSummaryResponse,
  ProductResponse,
  SupplierResponse
} from '../../../core/api/api-models';

/*
 * Scaffolding for invoice-create.component.spec.ts, which is this module's only consumer and is
 * expected to stay that way. The spec is above its size alarm but its cases cannot be split apart -
 * see the comment there - so what left it is what was never a test: the dictionaries, the payloads
 * and the service stubs.
 *
 * Constants, pure builders and stubs only. No beforeEach, afterEach, or any other hook registration
 * belongs here: hooks registered outside a describe block have been observed not to run for every
 * spec under coverage, so a hook placed here would silently protect nothing. Nor does any `vi.*`
 * call or `node:` import: this module is not a spec, so it is compiled by tsconfig.app.json, which
 * declares no types at all.
 */
export const TRANSLATIONS = {
  en: {
    invoices: {
      walkIn: 'Walk-in sale',
      type: { PURCHASE: 'Purchase', SALE: 'Sale' },
      form: {
        invoiceNumber: 'Invoice number',
        invoiceNumberRequired: 'An invoice number is required.'
      },
      createPage: {
        title: 'New invoice',
        typeLabel: 'Invoice type',
        counterpartySupplier: 'Supplier',
        counterpartyCustomer: 'Customer',
        dueDate: 'Due date',
        items: 'Items',
        addItem: 'Add item',
        removeItem: 'Remove item',
        product: 'Product',
        quantity: 'Quantity',
        unitPrice: 'Unit price',
        runningTotal: 'Running total',
        submit: 'Create invoice',
        cancel: 'Cancel'
      }
    }
  }
};

export const SUPPLIERS: SupplierResponse[] = [
  { id: 7, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '2026-01-02T03:04:00' }
];

export const CUSTOMERS: CustomerResponse[] = [
  {
    id: 9,
    name: 'Jane Doe',
    email: null,
    phone: null,
    address: null,
    city: null,
    createdAt: '2026-01-02T03:04:00'
  }
];

export const PRODUCTS: ProductResponse[] = [
  {
    id: 3,
    name: 'Widget',
    sku: 'SKU-3',
    quantity: 10,
    purchasePrice: 15,
    totalValue: 150,
    createdAt: '2026-01-02T03:04:00'
  },
  {
    id: 4,
    name: 'Widget Mini',
    sku: 'SKU-4',
    quantity: 5,
    purchasePrice: 8,
    totalValue: 40,
    createdAt: '2026-01-02T03:04:00'
  }
];

/*
 * Records every search each line's field asks for, so what the page sent can be asserted from the
 * rendered inputs rather than by calling the method under test.
 */
export class ProductServiceStub {
  readonly terms: string[] = [];
  results: ProductResponse[] = PRODUCTS;

  search(name: string): Observable<ProductResponse[]> {
    this.terms.push(name);
    return of(this.results);
  }
}

export const CREATED: InvoiceSummaryResponse = {
  id: 42,
  invoiceNumber: 'AR-2026-0001',
  type: 'SALE',
  status: 'OPEN',
  dueDate: '2026-03-01',
  supplierId: null,
  supplierName: null,
  customerId: null,
  customerName: null,
  closedAt: null,
  paidAt: null,
  createdAt: '2026-01-02T03:04:00'
};

export class InvoiceServiceStub {
  requests: CreateInvoiceRequest[] = [];
  result: Observable<InvoiceSummaryResponse> = of(CREATED);

  create(request: CreateInvoiceRequest): Observable<InvoiceSummaryResponse> {
    this.requests.push(request);
    return this.result;
  }
}

export class NotificationServiceStub {
  successes: string[] = [];
  errors: string[] = [];

  success(message: string): void {
    this.successes.push(message);
  }

  error(message: string): void {
    this.errors.push(message);
  }
}
