/**
 * Response wrapper used by most backend endpoints. The report endpoints return their
 * payload directly, so unwrapping belongs in feature services and never in an interceptor.
 */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
}
