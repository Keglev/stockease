/**
 * Response wrapper used by most backend endpoints. The report endpoints return their
 * payload directly, so unwrapping belongs in feature services and never in an interceptor.
 * This models the success shape services unwrap; the error shape is {@link ApiErrorEnvelope},
 * kept deliberately separate rather than folded in here as one type with optional halves.
 */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
}

/**
 * The body a failed call actually carries: the envelope fields, plus the optional machine-readable
 * code that tells apart two failures sharing one status.
 *
 * @remarks
 * The generated `ApiResponseError` in `api-types.ts` models this same response - it is what the
 * generator emits for the schema the backend's shared exception handler produces. This
 * hand-written twin exists anyway because services consume the hand-written vocabulary rather
 * than the generated definitions, and the generated file is never narrowed or reshaped to suit a
 * call site. What this replaces is a structural read at the one place that parses an error body.
 *
 * {@link code} is optional because the API assigns one only where a status alone leaves a client
 * unable to act: it is omitted from the JSON rather than sent as null, and it is never present on
 * a success envelope.
 *
 * {@link params} carries the runtime values that code's situation names - a product name, an SKU, an
 * invoice number - so a client rendering its own translated sentence has them without parsing the
 * server's. It rides with a code and is omitted the same way when there is none.
 */
export interface ApiErrorEnvelope {
  success: boolean;
  message: string;
  data: null;
  code?: string;
  params?: Readonly<Record<string, string>>;
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
 *
 * {@link params} accompanies a code and holds the values its sentence quotes. A consumer that
 * translates must treat missing params as it treats an unknown code: fall through to
 * {@link Error.message}, which always carries the server's own sentence with the values already in
 * it.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly params?: Readonly<Record<string, string>>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
