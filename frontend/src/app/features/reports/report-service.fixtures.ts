import { environment } from '../../../environments/environment';
import {
  CashFlowReport,
  CashFlowTimelineBucket,
  CustomerSummary,
  DueDateBucket,
  InvoiceDueSummary,
  LossReport,
  ProductProfitReport,
  StockStatusReport,
  SupplierProfitReport
} from '../../core/api/api-models';

/*
 * Scaffolding for report.service.spec.ts, which is this module's only consumer and is expected to
 * stay that way. The spec is above its size alarm but its cases cannot usefully be split - see the
 * comment there - so what left it is what was never a test: the request URL and the canned payloads
 * each endpoint flushes.
 *
 * Constants only. No beforeEach, afterEach, or any other hook registration belongs here: hooks
 * registered outside a describe block have been observed not to run for every spec under coverage,
 * so a hook placed here would silently protect nothing. Nor does any `vi.*` call or `node:` import:
 * this module is not a spec, so it is compiled by tsconfig.app.json, which declares no types at all.
 */
export const BASE_URL = `${environment.apiBaseUrl}/api/reports`;

export const PROFIT: ProductProfitReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, revenue: 100, cost: 40, grossProfit: 60 }
];

export const BUCKETS: DueDateBucket[] = [
  { dueDate: '2026-03-01', invoiceType: 'SALE', invoiceCount: 2, totalValue: 60 }
];

export const LOSSES: LossReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, lostUnits: 2, destroyedUnits: 1, lossValue: 15 }
];

export const OVERDUE: InvoiceDueSummary[] = [
  {
    invoiceId: 1,
    invoiceNumber: 'RE-2026-0001',
    invoiceType: 'SALE',
    counterparty: 'Jane Doe',
    dueDate: '2026-03-01',
    outstandingValue: 30,
    daysOverdue: 5
  }
];

export const SUMMARY: CustomerSummary = {
  customerId: 9,
  name: 'Jane Doe',
  deleted: false,
  saleInvoiceCount: 3,
  boughtUnits: 12,
  boughtValue: 240,
  returnedUnits: 2,
  returnedValue: 40
};

export const SUPPLIERS: SupplierProfitReport[] = [
  { supplierId: 7, name: 'Acme', revenue: 100, cost: 40, grossProfit: 60 }
];

export const DUE_SOON: InvoiceDueSummary[] = [
  {
    invoiceId: 9,
    invoiceNumber: 'RE-2026-0009',
    invoiceType: 'PURCHASE',
    counterparty: 'Acme',
    dueDate: '2026-03-05',
    outstandingValue: 40,
    // Null by design on this endpoint: only the overdue query computes the day count.
    daysOverdue: null
  }
];

export const CASH_FLOW: CashFlowReport = {
  inflow: 80,
  outflow: 30,
  net: 50,
  products: [
    { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, inflow: 80, outflow: 30, net: 50 }
  ]
};

export const TIMELINE: CashFlowTimelineBucket[] = [
  { month: '2026-02', inflow: 0, outflow: 45, net: -45 },
  { month: '2026-03', inflow: 80, outflow: 30, net: 50 }
];

export const STOCK: StockStatusReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', soldUnits: 4, soldRevenue: 60, inStockUnits: 6, inStockValue: 30 }
];
