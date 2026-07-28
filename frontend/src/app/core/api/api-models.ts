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
