import { RecordMovementRequest } from '../../core/api/api-models';

/** The three reasons this endpoint accepts; the invoice-flow reasons are booked elsewhere. */
export const STANDALONE_REASONS = ['NEW_PRODUCT', 'LOST', 'DESTROYED'] as const;

export type StandaloneReason = (typeof STANDALONE_REASONS)[number];

export interface MovementDraft {
  productId: number;
  reason: StandaloneReason;
  quantity: number;
  unitCost: number | null;
}

/**
 * Builds the record payload from a form draft. The unit cost is carried only for new stock,
 * because the service rejects it outright on any other reason.
 */
export function buildRecordMovementRequest(draft: MovementDraft): RecordMovementRequest {
  const request: RecordMovementRequest = {
    productId: draft.productId,
    reason: draft.reason,
    quantity: draft.quantity
  };

  // Omitted entirely rather than sent as null: the backend treats a present unitCost on a
  // non-NEW_PRODUCT movement as a 400, so the key must not appear at all.
  if (draft.reason === 'NEW_PRODUCT' && draft.unitCost !== null) {
    request.unitCost = draft.unitCost;
  }

  return request;
}
