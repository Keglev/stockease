import { DueDateBucket } from '../../core/api/api-models';

/**
 * The outstanding value one invoice type carries on one due date, or zero when it carries none.
 *
 * @remarks
 * The due-date endpoint answers a sparse list: a type that owes nothing on a date has no bucket
 * rather than a zero one. Both charts drawn from it plot a dense series per type, so every
 * date-and-type cell has to resolve to a number, and a missing bucket is a real zero rather than a
 * gap. Shared by the dashboard's due card and the reports page, which drew the same series twice.
 */
export function bucketValueAt(buckets: DueDateBucket[], date: string, type: string): number {
  const match = buckets.find((bucket) => bucket.dueDate === date && bucket.invoiceType === type);
  return match ? match.totalValue : 0;
}
