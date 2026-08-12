/**
 * Response wrapper used by most backend endpoints. The report endpoints return their
 * payload directly, so unwrapping belongs in feature services and never in an interceptor.
 */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
}

/**
 * An error raised by a failed HTTP call, carrying the status alongside the backend message.
 * It is an Error, so every consumer that only reads {@link Error.message} needs to know nothing
 * about it.
 *
 * @remarks
 * {@link code} is the envelope's optional machine-readable identifier. Most failures carry none,
 * so it is undefined far more often than not, and a consumer that branches on it must treat both
 * "absent" and "a value I do not know" as the same fall-through case: the API adds codes to
 * responses that previously had none.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
