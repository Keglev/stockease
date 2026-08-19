import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { ApiError } from '../api/api-envelope';

/**
 * The translated sentence each situation code stands for, keyed by the code the API sends.
 *
 * <p>One entry per code, and the entry's placeholders are the params that code's situation carries.
 * Adding a code here is the whole of teaching the app to translate it (ADR 041).
 */
const MESSAGE_KEYS: Readonly<Record<string, string>> = {
  DUPLICATE_PRODUCT_NAME: 'products.errors.duplicateName',
  DUPLICATE_PRODUCT_SKU: 'products.errors.duplicateSku',
  RESTORE_BLOCKED_BY_NAME: 'products.errors.restoreBlockedByName',
  RESTORE_BLOCKED_BY_SKU: 'products.errors.restoreBlockedBySku',
  DUPLICATE_INVOICE_NUMBER: 'invoices.errors.duplicateNumber',
  INVOICE_NOT_OPEN_FOR_CLOSE: 'invoices.errors.notOpenForClose',
  RETURN_REQUIRES_CLOSED_INVOICE: 'invoices.errors.returnRequiresClosed',
  RETURN_EXCEEDS_RETURNABLE: 'invoices.errors.returnExceedsReturnable',
  INVOICE_ALREADY_PAID: 'invoices.errors.alreadyPaid',
  INVOICE_NOT_OPEN_FOR_DELETE: 'invoices.errors.notOpenForDelete'
};

/** The params each key interpolates, so a response missing one falls through rather than rendering a gap. */
const REQUIRED_PARAMS: Readonly<Record<string, readonly string[]>> = {
  DUPLICATE_PRODUCT_NAME: ['name'],
  DUPLICATE_PRODUCT_SKU: ['sku'],
  RESTORE_BLOCKED_BY_NAME: ['name'],
  RESTORE_BLOCKED_BY_SKU: ['sku'],
  DUPLICATE_INVOICE_NUMBER: ['invoiceNumber'],
  RETURN_EXCEEDS_RETURNABLE: ['quantity', 'remaining', 'itemId']
};

/**
 * Turns a failed call into the sentence to show, translated where the API named the situation.
 *
 * @remarks
 * This is the single place the app translates an error, so a surface calls it and renders what it
 * returns without knowing which failures are coded. The backend's own message is the fallback and
 * always will be: most failures carry no code, and the ones that do were uncoded until recently
 * (ADR 041).
 *
 * Three cases fall through to that message, deliberately treated alike. An absent code is the
 * ordinary failure. An unknown code is a situation the API named after this build shipped - the
 * server's sentence is still correct English, which beats rendering a raw key. Missing params are
 * a coded failure whose values did not arrive, where the translated template would render with a
 * hole in it and the server's sentence already has the value in place.
 */
@Injectable({ providedIn: 'root' })
export class ErrorMessageService {
  private readonly translate = inject(TranslateService);

  /**
   * Returns the sentence to show for a failed call.
   *
   * @param error the failure, whether or not it is an {@link ApiError}
   * @returns the translated sentence when the situation is one this build knows, else the message
   */
  resolve(error: Error): string {
    if (!(error instanceof ApiError) || error.code === undefined) {
      return error.message;
    }
    const key = MESSAGE_KEYS[error.code];
    if (key === undefined) {
      return error.message;
    }
    const params = error.params;
    const required = REQUIRED_PARAMS[error.code] ?? [];
    if (required.some((name) => params?.[name] === undefined)) {
      return error.message;
    }
    return this.translate.instant(key, params) as string;
  }
}
