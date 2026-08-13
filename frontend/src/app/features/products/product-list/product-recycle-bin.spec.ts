import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { ApiError } from '../../../core/api/api-envelope';
import { PaginatedProducts } from '../../../core/api/api-models';
import { LanguageService } from '../../../core/i18n/language.service';
import { ProductListComponent } from './product-list.component';
import {
  configureProductListTestBed,
  NotificationServiceStub,
  pageWith,
  ProductServiceStub,
  host as hostOf
} from './product-list.fixtures';

/*
 * The recycle bin: who is offered the deleted view at all, what that view replaces while it is open,
 * and what restoring a product does - including the conflict a live name or SKU produces, which is
 * the one failure with a message of its own.
 *
 * The collaborator is driven through the real product list rather than constructed directly. It is a
 * component-scoped provider, and what these cases assert is a toggle on the page and what the table
 * shows afterwards; building it by hand would pin a wiring the spec invented rather than the one that
 * ships.
 * Out of scope: the live paged catalogue and its menu - product-list.component.spec.ts; the requests
 * (product.service.spec.ts).
 */
describe('ProductRecycleBin (through the product list)', () => {
  let fixture: ComponentFixture<ProductListComponent>;
  let stub: ProductServiceStub;
  let notifications: NotificationServiceStub;

  function host(): HTMLElement {
    return hostOf(fixture);
  }

  async function setUp(
    response: Observable<PaginatedProducts>,
    role: 'ADMIN' | 'USER' = 'ADMIN'
  ): Promise<void> {
    ({ fixture, stub, notifications } = await configureProductListTestBed(response, role));
  }

  /* Flips the "Show deleted" toggle, which only an admin can reach. */
  async function toggleDeleted(): Promise<void> {
    host().querySelector<HTMLElement>('.product-show-deleted button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => {
    localStorage.clear();
  });

  it('render_userRole_hidesShowDeletedToggle', async () => {
    await setUp(of(pageWith(['Laptop'])), 'USER');

    // Restoring is administration; a USER must not even be offered the view.
    expect(host().querySelector('.product-show-deleted')).toBeNull();
  });

  it('render_adminRole_showsShowDeletedToggle', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');

    expect(host().querySelector('.product-show-deleted')).not.toBeNull();
  });

  it('toggleDeleted_switchedOn_rendersDeletedRowsWithChipAndRestore', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');
    // #136: pin the language before asserting on rendered text
    TestBed.inject(LanguageService).setLanguage('en');

    await toggleDeleted();

    expect(stub.deletedCalls).toBe(1);
    const rows = host().querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(host().textContent).toContain('Retired Bracket');
    expect(rows[0].classList).toContain('product-row-deleted');
    expect(rows[0].querySelector('.status-deleted')?.textContent).toContain('Deleted');
    expect(rows[0].querySelector('.product-restore')).not.toBeNull();
  });

  it('toggleDeleted_switchedOn_hidesThePaginator', async () => {
    await setUp(of(pageWith(['Laptop'], 100)), 'ADMIN');
    expect(host().querySelector('mat-paginator')).not.toBeNull();

    await toggleDeleted();

    // The deleted set is unpaged, so a paginator here would state a page count that means nothing.
    expect(host().querySelector('mat-paginator')).toBeNull();
  });

  it('toggleDeleted_switchedOff_returnsToTheLivePagedView', async () => {
    await setUp(of(pageWith(['Laptop'], 100)), 'ADMIN');
    await toggleDeleted();

    await toggleDeleted();

    expect(host().textContent).toContain('Laptop');
    expect(host().textContent).not.toContain('Retired Bracket');
    expect(host().querySelector('mat-paginator')).not.toBeNull();
  });

  it('restore_succeeds_toastsAndRefreshesBothLists', async () => {
    await setUp(of(pageWith(['Laptop'], 100)), 'ADMIN');
    await toggleDeleted();
    const livesBefore = stub.calls.length;

    host().querySelector<HTMLButtonElement>('.product-restore')?.click();
    await fixture.whenStable();

    expect(stub.restoreCalls).toEqual([7]);
    expect(notifications.successes).toEqual(['products.restored']);
    // both lists move: the product leaves the bin and rejoins the live page behind the toggle
    expect(stub.deletedCalls).toBe(2);
    expect(stub.calls.length).toBe(livesBefore + 1);
  });

  it('restore_rejectedWith409_showsTheConflictNotification', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');
    await toggleDeleted();
    stub.restoreResult = throwError(
      () => new ApiError("Cannot restore: a live product named 'Laptop' already exists.", 409)
    );

    host().querySelector<HTMLButtonElement>('.product-restore')?.click();
    await fixture.whenStable();

    // The conflict is actionable, so it gets the translated explanation rather than the raw
    // backend sentence every other failure falls back to.
    expect(notifications.errors).toEqual(['products.restoreConflict']);
  });

  it('restore_rejectedWithOtherStatus_surfacesTheBackendMessage', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');
    await toggleDeleted();
    stub.restoreResult = throwError(() => new ApiError('Entity not found: gone.', 404));

    host().querySelector<HTMLButtonElement>('.product-restore')?.click();
    await fixture.whenStable();

    expect(notifications.errors).toEqual(['Entity not found: gone.']);
  });

  it('loadDeleted_serviceErrors_stopsTheLoadingBarAndShowsTheError', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');
    stub.deletedResult = throwError(() => new ApiError('Request failed. Please try again.', 404));

    await toggleDeleted();

    // The Vercel preview runs this branch against a backend without the endpoint, so the failed
    // fetch must read as an error rather than as a list that never finished loading.
    expect(host().textContent).toContain('Request failed. Please try again.');
    expect(host().querySelector('mat-progress-bar')).toBeNull();
  });
});
