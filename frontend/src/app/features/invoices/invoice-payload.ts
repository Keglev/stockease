import { CreateInvoiceRequest } from '../../core/api/api-models';

export type InvoiceType = CreateInvoiceRequest['type'];

export interface InvoiceDraft {
  type: InvoiceType;
  supplierId: number | null;
  customerId: number | null;
  dueDate: string;
  items: { productId: number; quantity: number; unitPrice: number }[];
}

/**
 * Builds the create payload from a form draft, omitting every key the invoice does not carry.
 * Absent keys are left out entirely rather than sent as null.
 */
export function buildCreateInvoiceRequest(draft: InvoiceDraft): CreateInvoiceRequest {
  const request: CreateInvoiceRequest = {
    type: draft.type,
    dueDate: draft.dueDate,
    items: draft.items
  };

  // The counterparty keys are mutually exclusive per type, and a sale without a customer is a
  // walk-in: sending the wrong key, or null, would be rejected or misread server-side.
  if (draft.type === 'PURCHASE' && draft.supplierId !== null) {
    request.supplierId = draft.supplierId;
  }
  if (draft.type === 'SALE' && draft.customerId !== null) {
    request.customerId = draft.customerId;
  }

  // interestRate and fineValue are deliberately never set: this system records inventory facts,
  // not financial calculations (ADR 011), so the accounting boundary stays visible in the UI.
  return request;
}
