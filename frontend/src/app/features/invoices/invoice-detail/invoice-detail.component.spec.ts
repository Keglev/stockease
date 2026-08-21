import { of, throwError } from 'rxjs';
import { ApiError } from '../../../core/api/api-envelope';

import {
  configureInvoiceDetailTestBed,
  detail,
  host,
  InvoiceDetailHarness
} from './invoice-detail.fixtures';

/*
 * One invoice as it reads on the page: a row per line, totals computed from those lines, the
 * counterparty taken from the snapshot on the response rather than looked up, and the timestamps and
 * type chip that follow the invoice's own state. Also that a failed load says so.
 * Out of scope: the lifecycle actions (invoice-detail-actions.spec.ts) and the returns flow
 * (invoice-detail-returns.spec.ts), the return quantity form
 * (invoice-return-dialog.component.spec.ts) and the requests (invoice.service.spec.ts).
 */
describe('InvoiceDetailComponent', () => {
  let page: InvoiceDetailHarness;

  afterEach(() => {
    localStorage.clear();
  });

  it('load_invoiceWithItems_rendersOneRowPerItem', async () => {
    page = await configureInvoiceDetailTestBed(of(detail()));

    expect(host(page.fixture).querySelectorAll('.items-table tbody tr').length).toBe(2);
    expect(host(page.fixture).textContent).toContain('Widget');
  });

  it('render_items_showsComputedLineTotals', async () => {
    page = await configureInvoiceDetailTestBed(of(detail()));

    const lineTotals = Array.from(host(page.fixture).querySelectorAll('.line-total')).map((cell) =>
      cell.textContent?.trim()
    );
    // 2 x 15 and 3 x 10.
    expect(lineTotals[0]).toContain('30');
    expect(lineTotals[1]).toContain('30');
  });

  it('render_multipleItems_sumsInvoiceTotal', async () => {
    page = await configureInvoiceDetailTestBed(of(detail()));

    expect(host(page.fixture).querySelector('.invoice-total-value')?.textContent).toContain('60');
  });

  it('counterparty_supplierNameOnResponse_isRenderedWithoutLookup', async () => {
    page = await configureInvoiceDetailTestBed(of(detail()));

    expect(host(page.fixture).querySelector('.detail-counterparty')?.textContent).toContain('Acme');
  });

  it('counterparty_bothNamesNull_rendersWalkInLabel', async () => {
    page = await configureInvoiceDetailTestBed(
      of(detail({ type: 'SALE', supplierId: null, supplierName: null }))
    );

    expect(host(page.fixture).querySelector('.detail-counterparty')?.textContent).toContain(
      'Walk-in sale'
    );
  });

  it('render_nullClosedAtAndPaidAt_omitsThoseRows', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ closedAt: null, paidAt: null })));

    expect(host(page.fixture).querySelector('.detail-closed')).toBeNull();
    expect(host(page.fixture).querySelector('.detail-paid')).toBeNull();
    expect(host(page.fixture).querySelector('.paid-chip')).toBeNull();
  });

  it('render_closedAtAndPaidAtSet_showsThoseRows', async () => {
    page = await configureInvoiceDetailTestBed(
      of(detail({ closedAt: '2026-02-01T10:00:00', paidAt: '2026-02-02T10:00:00' }))
    );

    expect(host(page.fixture).querySelector('.detail-closed')).not.toBeNull();
    expect(host(page.fixture).querySelector('.detail-paid')).not.toBeNull();
    expect(host(page.fixture).querySelector('.paid-chip')).not.toBeNull();
  });

  it('load_invoiceNotFoundInGerman_notifiesWithTheTranslatedSentence', async () => {
    // GET /api/invoices/{id} names its refusals now, so a stale bookmark arrives coded (#301).
    // Strong form: the catalog sentence present and the wire sentence absent, so this passes only
    // if the resolver replaced one with the other.
    page = await configureInvoiceDetailTestBed(throwError(() => new ApiError(
      'Entity not found: Invoice with ID 1 not found.', 404, 'INVOICE_NOT_FOUND', { id: '1' })), 'ADMIN', 'de');

    expect(page.notifications.errors).toContain('Rechnung mit der ID 1 wurde nicht gefunden.');
    expect(page.notifications.errors)
      .not.toContain('Entity not found: Invoice with ID 1 not found.');
  });

  it('load_requestFails_notifiesWithInterceptorMessage', async () => {
    page = await configureInvoiceDetailTestBed(throwError(() => new Error('Invoice not found.')));

    expect(page.notifications.errors).toEqual(['Invoice not found.']);
  });

  it('typeChip_purchaseInvoice_carriesThePurchaseClass', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ type: 'PURCHASE' })));

    // The same class the list picks for the same type: one invoice reads the same on both pages.
    expect(host(page.fixture).querySelector('.type-chip')?.classList.contains('type-purchase')).toBe(
      true
    );
  });

  it('typeChip_saleInvoice_carriesTheSaleClass', async () => {
    page = await configureInvoiceDetailTestBed(
      of(detail({ type: 'SALE', supplierId: null, supplierName: null, customerId: 9 }))
    );

    expect(host(page.fixture).querySelector('.type-chip')?.classList.contains('type-sale')).toBe(
      true
    );
  });
});
