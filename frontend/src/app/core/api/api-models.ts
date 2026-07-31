import { components } from './api-types';

/**
 * Friendly aliases over the generated schema map. Regenerate the source types with
 * `npm run gen:api` whenever the OpenAPI spec changes.
 */
export type ProductResponse = components['schemas']['ProductResponse'];

export type PaginatedProducts = components['schemas']['PaginatedProducts'];

export type SupplierResponse = components['schemas']['SupplierResponse'];

export type CustomerResponse = components['schemas']['CustomerResponse'];

export type InvoiceSummaryResponse = components['schemas']['InvoiceSummaryResponse'];

export type InvoiceResponse = components['schemas']['InvoiceResponse'];

export type InvoiceItemResponse = components['schemas']['InvoiceItemResponse'];

export type CreateInvoiceRequest = components['schemas']['CreateInvoiceRequest'];

export type RecordMovementRequest = components['schemas']['RecordMovementRequest'];

export type MovementResponse = components['schemas']['MovementResponse'];

export type RegisterReturnRequest = components['schemas']['RegisterReturnRequest'];

export type ProductProfitReport = components['schemas']['ProductProfitReport'];

export type SupplierProfitReport = components['schemas']['SupplierProfitReport'];

export type StockStatusReport = components['schemas']['StockStatusReport'];

export type CashFlowReport = components['schemas']['CashFlowReport'];

export type CashFlowProductRow = components['schemas']['CashFlowProductRow'];

export type CashFlowTimelineBucket = components['schemas']['CashFlowTimelineBucket'];

export type PaginatedInvoices = components['schemas']['PaginatedInvoices'];

export type LossReport = components['schemas']['LossReport'];

export type DueDateBucket = components['schemas']['DueDateBucket'];

export type InvoiceDueSummary = components['schemas']['InvoiceDueSummary'];

export type CustomerSummary = components['schemas']['CustomerSummary'];

export type ChangeLogResponse = components['schemas']['ChangeLogResponse'];

export type HealthStatus = components['schemas']['HealthStatus'];
