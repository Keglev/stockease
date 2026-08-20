import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { PaginatedProducts } from '../../../core/api/api-models';
import { ApiError } from '../../../core/api/api-envelope';
import { LanguageService } from '../../../core/i18n/language.service';
import { ProductCreateDialogComponent } from '../product-create-dialog/product-create-dialog.component';
import { ProductListComponent } from './product-list.component';
import {
  configureProductListTestBed,
  MatDialogStub,
  menuItem,
  NotificationServiceStub,
  openRowMenu as openRowMenuOf,
  pageWith,
  ProductServiceStub,
  host as hostOf
} from './product-list.fixtures';

/*
 * The catalogue: paged rows, the role-gated create and delete, and the menu items each role may
 * reach.
 * Out of scope: the recycle bin - the deleted view, its toggle and the restore flow are
 * product-recycle-bin.spec.ts; the dialogs (product-create-dialog and product-edit-dialog specs)
 * and the requests (product.service.spec.ts).
 */
describe('ProductListComponent', () => {
  let fixture: ComponentFixture<ProductListComponent>;
  let stub: ProductServiceStub;
  let notifications: NotificationServiceStub;
  let dialog: MatDialogStub;

  function host(): HTMLElement {
    return hostOf(fixture);
  }

  async function openRowMenu(rowIndex = 0): Promise<void> {
    await openRowMenuOf(fixture, rowIndex);
  }

  function rangeLabel(): string {
    return host().querySelector('.mat-mdc-paginator-range-label')?.textContent?.trim() ?? '';
  }

  async function setUp(
    response: Observable<PaginatedProducts>,
    role: 'ADMIN' | 'USER' = 'ADMIN'
  ): Promise<void> {
    ({ fixture, stub, notifications, dialog } = await configureProductListTestBed(response, role));
  }

  afterEach(() => {
    localStorage.clear();
  });

  it('load_serviceReturnsProducts_rendersOneRowPerProduct', async () => {
    await setUp(of(pageWith(['Laptop', 'Monitor', 'Keyboard'])));

    expect(host().querySelectorAll('tbody tr').length).toBe(3);
    expect(host().textContent).toContain('Laptop');
  });

  it('priceCell_germanLanguage_rendersGermanCurrencyNotEnUs', async () => {
    await setUp(of(pageWith(['Laptop'])));

    TestBed.inject(LanguageService).setLanguage('de');
    fixture.detectChanges();

    // The defect this closes: with no LOCALE_ID registered the app rendered "€99.50" here in both
    // languages. The pipe now asks FormatService, so a German reader sees a German amount.
    // Normalised on code points: which no-break space Intl puts before the symbol varies by ICU
    // version, and this assertion is about the currency format rather than about that.
    const text = [...(host().textContent ?? '')]
      .map((ch) => ([0xa0, 0x202f].includes(ch.codePointAt(0) ?? 0) ? ' ' : ch))
      .join('');
    expect(text).toContain('99,50 €');
    expect(text).not.toContain('€99.50');
  });

  it('load_serviceErrors_rendersErrorMessage', async () => {
    await setUp(throwError(() => new Error('Authentication required.')));

    expect(host().textContent).toContain('Authentication required.');
  });

  it('onPage_pageChanged_requestsNewPageFromService', async () => {
    await setUp(of(pageWith(['Laptop'], 100)));
    expect(stub.calls).toEqual([{ page: 0, size: 10 }]);

    host().querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-next')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(stub.calls.length).toBe(2);
    expect(stub.calls[1]).toEqual({ page: 1, size: 10 });
  });

  it('pageChange_requestFails_paginatorStopsCountingRowsThatAreGone', async () => {
    await setUp(of(pageWith(['Laptop'], 100)));
    expect(rangeLabel()).toContain('100');

    // A count that outlives the rows it counted misreads the failure for the operator: an error
    // banner over an empty table, with the paginator still offering ten pages of a hundred
    // products, says the catalogue is intact and only this page went missing. Nothing is known
    // about the catalogue after a failed request, and the paginator has to say so.
    stub.response = throwError(() => new Error('Authentication required.'));

    host().querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-next')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(rangeLabel()).toBe('0 of 0');
  });

  it('render_adminRole_showsCreateButton', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');

    expect(host().querySelector('.product-create')).not.toBeNull();
  });

  it('render_userRole_hidesCreateButton', async () => {
    await setUp(of(pageWith(['Laptop'])), 'USER');

    expect(host().querySelector('.product-create')).toBeNull();
  });

  it('menu_adminRole_showsDeleteItem', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');
    await openRowMenu();

    expect(menuItem('.product-delete')).not.toBeNull();
  });

  it('menu_userRole_hidesDeleteItem', async () => {
    await setUp(of(pageWith(['Laptop'])), 'USER');
    await openRowMenu();

    expect(menuItem('.product-delete')).toBeNull();
  });

  it('menu_userRole_stillOffersRenameAndPrice', async () => {
    await setUp(of(pageWith(['Laptop'])), 'USER');
    await openRowMenu();

    expect(menuItem('.product-rename')).not.toBeNull();
    expect(menuItem('.product-reprice')).not.toBeNull();
  });

  it('menu_userRole_showsHistoryItem', async () => {
    await setUp(of(pageWith(['Laptop'])), 'USER');
    await openRowMenu();

    // Ungated: the backend guards the audit endpoints with hasAnyRole, not an admin check.
    expect(menuItem('.product-history')).not.toBeNull();
  });

  it('history_clicked_navigatesToThatProductsAuditRoute', async () => {
    await setUp(of(pageWith(['Laptop'])), 'USER');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    await openRowMenu();
    menuItem('.product-history')?.click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/app/audit/products', 1]);
  });

  it('render_anyRole_offersNoQuantityEditing', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');
    await openRowMenu();

    // Quantity changes exist only as stock movements; the table must expose no editor.
    const quantityCell = host().querySelectorAll('tbody tr')[0].querySelectorAll('td')[2];
    expect(quantityCell.querySelectorAll('input, select, textarea, button').length).toBe(0);
    expect(quantityCell.getAttribute('contenteditable')).toBeNull();

    const menuText = (document.querySelector('.mat-mdc-menu-panel')?.textContent ?? '')
      .toLowerCase();
    expect(menuText).not.toContain('quantity');
    expect(menuText).not.toContain('menge');
  });

  it('delete_confirmed_callsServiceAndReloadsCurrentPage', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');
    dialog.confirmed = true;
    const loadsBefore = stub.calls.length;

    await openRowMenu();
    menuItem('.product-delete')?.click();
    await fixture.whenStable();

    expect(stub.removeCalls).toEqual([1]);
    expect(notifications.successes).toEqual(['Product deleted.']);
    expect(stub.calls.length).toBe(loadsBefore + 1);
  });

  it('create_clicked_opensCreateDialogAndAnnouncesTheNewProduct', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');
    dialog.saved = pageWith(['Monitor']).content[0];

    host().querySelector<HTMLButtonElement>('.product-create')?.click();
    await fixture.whenStable();

    expect(dialog.openCalls.map((call) => call.component)).toEqual([ProductCreateDialogComponent]);
    expect(notifications.successes).toEqual(['products.created']);
  });

  it('create_dismissed_announcesNothingAndDoesNotReload', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');
    dialog.saved = undefined;
    const loadsBefore = stub.calls.length;

    host().querySelector<HTMLButtonElement>('.product-create')?.click();
    await fixture.whenStable();

    expect(notifications.successes).toEqual([]);
    expect(stub.calls.length).toBe(loadsBefore);
  });

  it('rename_clicked_opensEditDialogInNameModeAndAnnouncesTheRename', async () => {
    await setUp(of(pageWith(['Laptop'])), 'USER');
    dialog.saved = pageWith(['Laptop Pro']).content[0];

    await openRowMenu();
    menuItem('.product-rename')?.click();
    await fixture.whenStable();

    expect(dialog.openCalls.at(-1)?.config?.data).toEqual({
      mode: 'name',
      product: pageWith(['Laptop']).content[0]
    });
    expect(notifications.successes).toEqual(['products.renamed']);
  });

  it('reprice_clicked_opensEditDialogInPriceModeAndAnnouncesThePriceChange', async () => {
    await setUp(of(pageWith(['Laptop'])), 'USER');
    dialog.saved = pageWith(['Laptop']).content[0];

    await openRowMenu();
    menuItem('.product-reprice')?.click();
    await fixture.whenStable();

    // the mode decides both the dialog's shape and which message the list announces
    expect((dialog.openCalls.at(-1)?.config?.data as { mode: string }).mode).toBe('price');
    expect(notifications.successes).toEqual(['products.priceChanged']);
  });

  it('edit_dismissed_announcesNothingAndDoesNotReload', async () => {
    await setUp(of(pageWith(['Laptop'])), 'USER');
    dialog.saved = undefined;
    const loadsBefore = stub.calls.length;

    await openRowMenu();
    menuItem('.product-rename')?.click();
    await fixture.whenStable();

    expect(notifications.successes).toEqual([]);
    expect(stub.calls.length).toBe(loadsBefore);
  });

  it('delete_cancelled_leavesTheProductUntouched', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');
    dialog.confirmed = false;

    await openRowMenu();
    menuItem('.product-delete')?.click();
    await fixture.whenStable();

    expect(stub.removeCalls).toEqual([]);
    expect(notifications.successes).toEqual([]);
  });

  it('load_requestInFlight_showsTheProgressBar', async () => {
    await setUp(new Subject<PaginatedProducts>(), 'ADMIN');

    expect(host().querySelector('mat-progress-bar')).not.toBeNull();
    expect(host().querySelector('.product-empty')).toBeNull();
  });

  it('load_noLiveProducts_showsTheLiveEmptyState', async () => {
    await setUp(of(pageWith([])), 'ADMIN');

    expect(host().querySelector('.product-empty')?.textContent?.trim()).toBe('No products found.');
  });

  it('load_noDeletedProducts_showsTheDeletedEmptyState', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');
    stub.deletedResult = of([]);

    await toggleDeleted();

    // a different sentence, not the same one: the deleted view being empty is good news
    expect(host().querySelector('.product-empty')?.textContent?.trim()).toBe('No deleted products.');
  });

  it('delete_rejected_surfacesErrorNotification', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');
    dialog.confirmed = true;
    stub.removeResult = throwError(() => new Error('Product cannot be deleted.'));

    await openRowMenu();
    menuItem('.product-delete')?.click();
    await fixture.whenStable();

    expect(notifications.errors).toEqual(['Product cannot be deleted.']);
  });

  /*
   * The two coded refusals a delete can meet (ADR 041 phase 3.3). Both are asserted in German and
   * whole: the English keys mirror the wire sentences byte for byte, so an English expectation
   * would pass with the resolver call reverted. They are separate cases because the operator is
   * asked for different things - settle the invoice, or write the stock off first.
   */
  it('delete_vetoedByAnOpenInvoice_surfacesTheGermanSentence', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');
    TestBed.inject(LanguageService).setLanguage('de');
    dialog.confirmed = true;
    stub.removeResult = throwError(
      () => new ApiError("Cannot delete product 'Laptop': it appears on an open invoice.", 409,
        'PRODUCT_ON_OPEN_INVOICE', { productName: 'Laptop' })
    );

    await openRowMenu();
    menuItem('.product-delete')?.click();
    await fixture.whenStable();

    expect(notifications.errors)
      .toEqual(["Produkt 'Laptop' kann nicht gelöscht werden: Es steht auf einer offenen Rechnung."]);
  });

  it('delete_refusedWhileStocked_surfacesTheGermanSentenceWithTheQuantity', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');
    TestBed.inject(LanguageService).setLanguage('de');
    dialog.confirmed = true;
    stub.removeResult = throwError(
      () => new ApiError("Cannot delete product 'Laptop': 7 units are still in stock.", 409,
        'PRODUCT_HAS_STOCK', { productName: 'Laptop', quantity: '7' })
    );

    await openRowMenu();
    menuItem('.product-delete')?.click();
    await fixture.whenStable();

    expect(notifications.errors)
      .toEqual(["Produkt 'Laptop' kann nicht gelöscht werden: 7 Einheiten sind noch auf Lager."]);
  });

  /* Flips the "Show deleted" toggle, which only an admin can reach. */
  async function toggleDeleted(): Promise<void> {
    host().querySelector<HTMLElement>('.product-show-deleted button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }
});
