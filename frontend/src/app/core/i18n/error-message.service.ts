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
  INVOICE_NOT_OPEN_FOR_DELETE: 'invoices.errors.notOpenForDelete',
  SUPPLIER_HAS_OPEN_INVOICES: 'suppliers.errors.hasOpenInvoices',
  CUSTOMER_HAS_OPEN_INVOICES: 'customers.errors.hasOpenInvoices',
  PRODUCT_ON_OPEN_INVOICE: 'products.errors.onOpenInvoice',
  PRODUCT_HAS_STOCK: 'products.errors.hasStock',
  /*
   * The movement validation matrix, in the order the backend raises it.
   *
   * Ten of these sixteen cannot be reached over HTTP and are latent by design. The request records
   * are narrower than the command the API validates - they carry no unitCost at all - and bean
   * validation and the two controllers' reason gates catch the rest, so those rules guard a caller
   * the HTTP surface cannot produce (backend rulings R45 and R47). They are translated anyway, so
   * the sentence is ready the moment a shadow moves. Do not prune them as dead keys: their being
   * unreachable today is the recorded decision, not an oversight.
   */
  MOVEMENT_ENDPOINT_RETURNS_ONLY: 'movements.errors.endpointReturnsOnly',
  MOVEMENT_REASON_NOT_STANDALONE: 'movements.errors.reasonNotStandalone',
  MOVEMENT_USER_REQUIRED: 'movements.errors.userRequired',
  MOVEMENT_PRODUCT_AND_REASON_REQUIRED: 'movements.errors.productAndReasonRequired',
  MOVEMENT_QUANTITY_NOT_POSITIVE: 'movements.errors.quantityNotPositive',
  LOSS_MOVEMENT_CARRIES_NO_INVOICE_DATA: 'movements.errors.lossCarriesNoInvoiceData',
  LOSS_MOVEMENT_REQUIRES_REMARK: 'movements.errors.lossRequiresRemark',
  MOVEMENT_REQUIRES_INVOICE_ITEM: 'movements.errors.requiresInvoiceItem',
  MOVEMENT_UNIT_COST_DERIVED: 'movements.errors.unitCostDerived',
  MOVEMENT_REMARK_FORBIDDEN: 'movements.errors.remarkForbidden',
  MOVEMENT_INVOICE_TYPE_MISMATCH: 'movements.errors.invoiceTypeMismatch',
  MOVEMENT_INVOICE_OPEN: 'movements.errors.invoiceOpen',
  MOVEMENT_ITEM_PRODUCT_MISMATCH: 'movements.errors.itemProductMismatch',
  MOVEMENT_QUANTITY_MISMATCH: 'movements.errors.quantityMismatch',
  MOVEMENT_ALREADY_RECORDED: 'movements.errors.alreadyRecorded',
  RETURN_REQUIRES_SALE_MOVEMENT: 'movements.errors.returnRequiresSaleMovement',
  /*
   * The invalid-request family, in the order the backend raises it. Twelve codes over thirteen
   * throw sites: the reporting and audit controllers restate the same period check independently
   * and share PERIOD_START_AFTER_END, so one key serves both surfaces (backend ruling R48).
   *
   * Eight of the twelve are latent, for the same reason as the movement matrix above: the request
   * records declare the same rule as a bean-validation constraint, so a client sending the bad
   * value gets the validation envelope and never reaches the service check behind it. They are
   * translated anyway (R45, R47) so the sentence is ready if a constraint is ever relaxed. Do not
   * prune them as dead keys.
   *
   * None of the twelve carries params - every sentence in this family is fixed - so none appears
   * in REQUIRED_PARAMS or PARAM_TRANSLATIONS below.
   */
  INVOICE_TYPE_REQUIRED: 'invoices.errors.invoiceTypeRequired',
  INVOICE_DUE_DATE_REQUIRED: 'invoices.errors.invoiceDueDateRequired',
  INVOICE_REQUIRES_ITEM: 'invoices.errors.invoiceRequiresItem',
  INVOICE_NUMBER_REQUIRED: 'invoices.errors.invoiceNumberRequired',
  PURCHASE_INVOICE_PARTY_MISMATCH: 'invoices.errors.purchaseInvoicePartyMismatch',
  SALE_INVOICE_PARTY_MISMATCH: 'invoices.errors.saleInvoicePartyMismatch',
  ITEM_QUANTITY_NOT_POSITIVE: 'invoices.errors.itemQuantityNotPositive',
  ITEM_UNIT_PRICE_NOT_POSITIVE: 'invoices.errors.itemUnitPriceNotPositive',
  RETURN_QUANTITY_NOT_POSITIVE: 'invoices.errors.returnQuantityNotPositive',
  PERIOD_START_AFTER_END: 'reports.errors.periodStartAfterEnd',
  REPORT_DAYS_NOT_POSITIVE: 'reports.errors.reportDaysNotPositive',
  SUPPLIER_NAME_AND_ADDRESS_REQUIRED: 'suppliers.errors.supplierNameAndAddressRequired',
  /*
   * The shape refusal: a request turned away before any domain rule ran, because a constraint on
   * the request itself rejected it. Cross-cutting rather than any feature's, and one situation
   * reached three ways - bean validation on a request body, a missing required query parameter,
   * and constraint violations on handler arguments - which is why it is the first common.* key in
   * this map: it belongs to no feature, so filing it under one would be arbitrary.
   *
   * Carries no params - the sentence is fixed - so it appears in neither REQUIRED_PARAMS nor
   * PARAM_TRANSLATIONS below. The envelope's data field-to-sentence map stays English by design
   * and is deliberately not translated: the interceptor discards data and the forms carry their
   * own client-side messages for the same fields, so the banner is the only sentence an operator
   * meets (see the ApiErrorCodes Javadoc for VALIDATION_FAILED).
   */
  VALIDATION_FAILED: 'common.errors.validationFailed',
  /*
   * The not-found family, in the order the backend raises it. Seven situations that all answer 404
   * and read as one sentence apiece, so the code is the only thing separating them: an unknown
   * product and a product with no profit report are the same status and two different things to
   * tell the operator - the first means the row is gone, the second means the row is fine and the
   * period is empty.
   *
   * Every member carries the same single param, id, and nothing else. It is the only part of each
   * sentence that is not fixed prose, which is why all seven appear in REQUIRED_PARAMS below. None
   * appears in PARAM_TRANSLATIONS: an id is a value, not an enum token, and interpolates exactly as
   * it arrives.
   *
   * No member of this family is latent. All seven were reachable on the first wire probe, because
   * every one sits behind a lookup by id a client can ask for with an id that is not there - so
   * unlike the movement and invalid-request families above, there is no dead-key clause to write
   * here and none of these keys is waiting for a shadow to move.
   */
  CUSTOMER_NOT_FOUND: 'customers.errors.customerNotFound',
  INVOICE_NOT_FOUND: 'invoices.errors.invoiceNotFound',
  INVOICE_ITEM_NOT_FOUND: 'invoices.errors.invoiceItemNotFound',
  PRODUCT_NOT_FOUND: 'products.errors.productNotFound',
  SOFT_DELETED_PRODUCT_NOT_FOUND: 'products.errors.softDeletedProductNotFound',
  SUPPLIER_NOT_FOUND: 'suppliers.errors.supplierNotFound',
  PROFIT_REPORT_NOT_FOUND: 'reports.errors.profitReportNotFound'
};

/** The params each key interpolates, so a response missing one falls through rather than rendering a gap. */
const REQUIRED_PARAMS: Readonly<Record<string, readonly string[]>> = {
  DUPLICATE_PRODUCT_NAME: ['name'],
  DUPLICATE_PRODUCT_SKU: ['sku'],
  RESTORE_BLOCKED_BY_NAME: ['name'],
  RESTORE_BLOCKED_BY_SKU: ['sku'],
  DUPLICATE_INVOICE_NUMBER: ['invoiceNumber'],
  RETURN_EXCEEDS_RETURNABLE: ['quantity', 'remaining', 'itemId'],
  SUPPLIER_HAS_OPEN_INVOICES: ['supplierName'],
  CUSTOMER_HAS_OPEN_INVOICES: ['customerName'],
  PRODUCT_ON_OPEN_INVOICE: ['productName'],
  PRODUCT_HAS_STOCK: ['productName', 'quantity'],
  MOVEMENT_REQUIRES_INVOICE_ITEM: ['reason'],
  MOVEMENT_REMARK_FORBIDDEN: ['reason'],
  MOVEMENT_INVOICE_TYPE_MISMATCH: ['reason', 'requiredType'],
  MOVEMENT_ITEM_PRODUCT_MISMATCH: ['invoiceItemId'],
  MOVEMENT_QUANTITY_MISMATCH: ['quantity'],
  MOVEMENT_ALREADY_RECORDED: ['reason', 'invoiceItemId'],
  CUSTOMER_NOT_FOUND: ['id'],
  INVOICE_NOT_FOUND: ['id'],
  INVOICE_ITEM_NOT_FOUND: ['id'],
  PRODUCT_NOT_FOUND: ['id'],
  SOFT_DELETED_PRODUCT_NOT_FOUND: ['id'],
  SUPPLIER_NOT_FOUND: ['id'],
  PROFIT_REPORT_NOT_FOUND: ['id']
};

/**
 * The params that arrive as enum tokens rather than as values, and the catalog branch each is
 * named under.
 *
 * @remarks
 * The API sends `reason` as `RETURN_FROM_CUSTOMER` and `requiredType` as `SALE` - raw tokens, not
 * prose, and deliberately so: the token is the stable contract and the language it should be read
 * in is the client's business. A sentence that interpolated one unchanged would be German prose
 * with an English shout in the middle of it.
 *
 * So a param listed here is looked up as `prefix.TOKEN` before the sentence is built. Params that
 * are not listed - an id, a quantity - are values and interpolate exactly as they arrive.
 */
const PARAM_TRANSLATIONS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  MOVEMENT_REQUIRES_INVOICE_ITEM: { reason: 'movements.reason' },
  MOVEMENT_REMARK_FORBIDDEN: { reason: 'movements.reason' },
  MOVEMENT_INVOICE_TYPE_MISMATCH: { reason: 'movements.reason', requiredType: 'invoices.type' },
  MOVEMENT_ALREADY_RECORDED: { reason: 'movements.reason' }
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
 * Four cases fall through to that message, deliberately treated alike. An absent code is the
 * ordinary failure. An unknown code is a situation the API named after this build shipped - the
 * server's sentence is still correct English, which beats rendering a raw key. Missing params are
 * a coded failure whose values did not arrive, where the translated template would render with a
 * hole in it and the server's sentence already has the value in place. An enum param whose token
 * this build has no word for is the same case one level down: the sentence would come out half
 * translated, which reads worse than English that is merely English.
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
    const translated = this.translateEnumParams(error.code, params);
    if (translated === undefined) {
      return error.message;
    }
    return this.translate.instant(key, translated) as string;
  }

  /**
   * Replaces enum-token params with their translated words, leaving value params alone.
   *
   * @param code the situation code, which decides which params are enums
   * @param params the params as they arrived
   * @returns the params to interpolate, or `undefined` when a token has no catalog entry
   *
   * @remarks
   * A token this build has no word for returns `undefined`, which sends the caller to the server's
   * message - the fourth member of the same family as the three fall-throughs above, and for the
   * same reason. The alternatives are worse in both directions: interpolating the raw token would
   * put `RETURNED_TO_SUPPLIER` inside a German sentence, and rendering the missing key would put
   * `movements.reason.RETURNED_TO_SUPPLIER` there. A half-translated sentence reads as a bug to
   * the operator; the server's English sentence reads as English.
   */
  private translateEnumParams(
    code: string,
    params: Readonly<Record<string, string>> | undefined
  ): Record<string, string> | undefined {
    const enumParams = PARAM_TRANSLATIONS[code];
    if (enumParams === undefined || params === undefined) {
      return { ...params };
    }
    const resolved: Record<string, string> = { ...params };
    for (const [name, prefix] of Object.entries(enumParams)) {
      const token = params[name];
      if (token === undefined) {
        continue;
      }
      const paramKey = `${prefix}.${token}`;
      const word = this.translate.instant(paramKey) as string;
      // ngx-translate echoes the key back when it has no entry for it; that echo is the miss.
      if (word === paramKey) {
        return undefined;
      }
      resolved[name] = word;
    }
    return resolved;
  }
}
