import { RecordMovementRequest } from '../../core/api/api-models';

/**
 * The two reasons this endpoint accepts. It is a loss ledger: stock never enters through it, so
 * there is no incoming reason to offer - new stock arrives by closing a purchase invoice (ADR 021).
 */
export const STANDALONE_REASONS = ['LOST', 'DESTROYED'] as const;

export type StandaloneReason = (typeof STANDALONE_REASONS)[number];

/** The fixed taxonomy a loss is explained with; one list serves LOST and DESTROYED alike. */
export const MOVEMENT_REMARKS = [
  'EXPIRED',
  'IN_TRANSIT_TO_CUSTOMER',
  'INTERNAL',
  'FROM_SUPPLIER'
] as const;

export type MovementRemarkValue = (typeof MOVEMENT_REMARKS)[number];

export interface MovementDraft {
  productId: number;
  reason: StandaloneReason;
  quantity: number;
  remark: MovementRemarkValue;
}

/**
 * Builds the record payload from a form draft.
 *
 * <p>Three keys, always the same three: every reason this endpoint accepts is a loss, so the remark
 * is unconditional, and no reason carries a price - a cost snapshot belongs to a purchase line.
 */
export function buildRecordMovementRequest(draft: MovementDraft): RecordMovementRequest {
  return {
    productId: draft.productId,
    reason: draft.reason,
    quantity: draft.quantity,
    remark: draft.remark
  };
}
