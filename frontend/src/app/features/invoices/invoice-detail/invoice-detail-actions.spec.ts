import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import {
  configureInvoiceDetailTestBed,
  detail,
  host,
  InvoiceDetailHarness,
  settle
} from './invoice-detail.fixtures';

/*
 * The invoice's lifecycle actions: which of close, mark-paid and delete are offered for a given
 * status, payment state and role, what each one calls, and what the page does with the answer - a
 * re-read after a change, a message and no navigation after a refusal. Also that every confirmation
 * names the invoice it is about to act on.
 *
 * The collaborator is driven through the real detail page rather than constructed directly. It is a
 * component-scoped provider, and what these cases assert is the page's affordances and what happens
 * after a click; building it by hand would pin a wiring the spec invented rather than the one that
 * ships.
 * Out of scope: rendering and load (invoice-detail.component.spec.ts) and the returns flow
 * (invoice-detail-returns.spec.ts).
 */
describe('InvoiceDetailActions (through the detail page)', () => {
  let page: InvoiceDetailHarness;

  afterEach(() => {
    localStorage.clear();
  });

  it('actions_adminWithOpenInvoice_showsCloseMarkPaidAndDelete', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'OPEN', paidAt: null })));

    expect(host(page.fixture).querySelector('.action-close')).not.toBeNull();
    expect(host(page.fixture).querySelector('.action-paid')).not.toBeNull();
    expect(host(page.fixture).querySelector('.action-delete')).not.toBeNull();
  });

  it('actions_adminWithClosedUnpaidInvoice_showsMarkPaidOnly', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED', paidAt: null })));

    expect(host(page.fixture).querySelector('.action-close')).toBeNull();
    expect(host(page.fixture).querySelector('.action-paid')).not.toBeNull();
    expect(host(page.fixture).querySelector('.action-delete')).toBeNull();
  });

  it('actions_adminWithClosedPaidInvoice_showsNoActions', async () => {
    page = await configureInvoiceDetailTestBed(
      of(detail({ status: 'CLOSED', paidAt: '2026-02-02T10:00:00' }))
    );

    expect(host(page.fixture).querySelector('.action-close')).toBeNull();
    expect(host(page.fixture).querySelector('.action-paid')).toBeNull();
    expect(host(page.fixture).querySelector('.action-delete')).toBeNull();
  });

  it('actions_adminWithFullyReturnedUnpaidInvoice_showsMarkPaidOnly', async () => {
    page = await configureInvoiceDetailTestBed(
      of(detail({ status: 'FULLY_RETURNED', paidAt: null }))
    );

    expect(host(page.fixture).querySelector('.action-close')).toBeNull();
    expect(host(page.fixture).querySelector('.action-paid')).not.toBeNull();
    expect(host(page.fixture).querySelector('.action-delete')).toBeNull();
  });

  it('actions_nonAdminWithOpenInvoice_showsNoActions', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'OPEN', paidAt: null })), 'USER');

    // Non-admins get no lifecycle affordance at all; the server enforces 403 regardless.
    expect(host(page.fixture).querySelector('.action-close')).toBeNull();
    expect(host(page.fixture).querySelector('.action-paid')).toBeNull();
    expect(host(page.fixture).querySelector('.action-delete')).toBeNull();
  });

  it('close_confirmed_callsServiceAndRefetchesDetail', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'OPEN' })));
    const loadsBefore = page.invoices.getByIdCalls;

    host(page.fixture).querySelector<HTMLButtonElement>('.action-close')?.click();
    await settle(page.fixture);

    expect(page.invoices.closeCalls).toEqual([1]);
    expect(page.notifications.successes).toEqual(['invoices.actions.closed']);
    expect(page.invoices.getByIdCalls).toBe(loadsBefore + 1);
  });

  it('close_insufficientStock_surfacesMessageAndStillRefetches', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'OPEN' })));
    page.invoices.closeResult = throwError(
      () => new Error('Insufficient stock for product Widget.')
    );
    const loadsBefore = page.invoices.getByIdCalls;

    host(page.fixture).querySelector<HTMLButtonElement>('.action-close')?.click();
    await settle(page.fixture);

    expect(page.notifications.errors).toEqual(['Insufficient stock for product Widget.']);
    // The close rolled back entirely, so the page is re-read to prove nothing changed.
    expect(page.invoices.getByIdCalls).toBe(loadsBefore + 1);
  });

  it('close_cancelled_callsNothing', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'OPEN' })));
    page.dialog.confirmed = false;

    host(page.fixture).querySelector<HTMLButtonElement>('.action-close')?.click();
    await settle(page.fixture);

    expect(page.invoices.closeCalls).toEqual([]);
  });

  it('markPaid_confirmed_callsServiceAndRefetchesDetail', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED', paidAt: null })));
    const loadsBefore = page.invoices.getByIdCalls;

    host(page.fixture).querySelector<HTMLButtonElement>('.action-paid')?.click();
    await settle(page.fixture);

    expect(page.invoices.paidCalls).toEqual([1]);
    expect(page.notifications.successes).toEqual(['invoices.actions.markedPaid']);
    expect(page.invoices.getByIdCalls).toBe(loadsBefore + 1);
  });

  it('delete_confirmed_notifiesBackendMessageAndNavigatesToList', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'OPEN' })));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    host(page.fixture).querySelector<HTMLButtonElement>('.action-delete')?.click();
    await settle(page.fixture);

    expect(page.invoices.removeCalls).toEqual([1]);
    expect(page.notifications.successes).toEqual(['Invoice deleted.']);
    expect(navigate).toHaveBeenCalledWith(['/app/invoices']);
  });

  it('confirmClose_dialogOpened_namesTheInvoiceByNumber', async () => {
    page = await configureInvoiceDetailTestBed(
      of(detail({ status: 'OPEN', invoiceNumber: 'RE-2026-0117' }))
    );

    host(page.fixture).querySelector<HTMLButtonElement>('.action-close')?.click();
    await settle(page.fixture);

    expect(page.dialog.lastData?.messageKey).toBe('invoices.actions.closeConfirmMessage');
    expect(page.dialog.lastData?.messageParams).toEqual({ number: 'RE-2026-0117' });
  });

  it('confirmMarkPaid_dialogOpened_namesTheInvoiceByNumber', async () => {
    page = await configureInvoiceDetailTestBed(
      of(detail({ status: 'CLOSED', paidAt: null, invoiceNumber: 'RE-2026-0118' }))
    );

    host(page.fixture).querySelector<HTMLButtonElement>('.action-paid')?.click();
    await settle(page.fixture);

    expect(page.dialog.lastData?.messageParams).toEqual({ number: 'RE-2026-0118' });
  });

  it('confirmDelete_dialogOpened_namesTheInvoiceByNumber', async () => {
    page = await configureInvoiceDetailTestBed(
      of(detail({ status: 'OPEN', invoiceNumber: 'RE-2026-0119' }))
    );

    host(page.fixture).querySelector<HTMLButtonElement>('.action-delete')?.click();
    await settle(page.fixture);

    // A destructive prompt must state which invoice it is about to act on.
    expect(page.dialog.lastData?.messageParams).toEqual({ number: 'RE-2026-0119' });
  });

  it('delete_rejected_surfacesMessageAndStaysOnPage', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'OPEN' })));
    page.invoices.removeResult = throwError(
      () => new Error('Only open invoices can be deleted.')
    );
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    host(page.fixture).querySelector<HTMLButtonElement>('.action-delete')?.click();
    await settle(page.fixture);

    expect(page.notifications.errors).toEqual(['Only open invoices can be deleted.']);
    expect(navigate).not.toHaveBeenCalled();
  });
});
