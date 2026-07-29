import { RecordMovementRequest } from '../../core/api/api-models';

/** The three reasons this endpoint accepts; the invoice-flow reasons are booked elsewhere. */
export const STANDALONE_REASONS = ['NEW_PRODUCT', 'LOST', 'DESTROYED'] as const;

export type StandaloneReason = (typeof STANDALONE_REASONS)[number];

/** The fixed taxonomy a loss is explained with; one list serves LOST and DESTROYED alike. */
export const MOVEMENT_REMARKS = [
  'EXPIRED',
  'IN_TRANSIT_TO_CUSTOMER',
  'INTERNAL',
  'FROM_SUPPLIER'
] as const;

export type MovementRemarkValue = (typeof MOVEMENT_REMARKS)[number];

/** The two reasons that require a remark; every other reason must omit it. */
export function requiresRemark(reason: StandaloneReason): boolean {
  return reason === 'LOST' || reason === 'DESTROYED';
}

export interface MovementDraft {
  productId: number;
  reason: StandaloneReason;
  quantity: number;
  unitCost: number | null;
  remark: MovementRemarkValue | null;
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

  // Same rule for the remark: required by LOST and DESTROYED, a 400 on anything else, so the key
  // is present exactly when the reason calls for it.
  if (requiresRemark(draft.reason) && draft.remark !== null) {
    request.remark = draft.remark;
  }

  return request;
}
