import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { PaginatedProducts, ProductResponse } from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/interceptors/error.interceptor';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { ProductService } from '../product.service';
import { ProductListComponent } from './product-list.component';

const TRANSLATIONS = {
  en: {
    common: { confirm: 'Confirm', cancel: 'Cancel' },
    products: {
      title: 'Products',
      create: 'New product',
      actions: 'Product actions',
      rename: 'Rename',
      changePrice: 'Change price',
      history: 'History',
      columns: {
        name: 'Name',
        sku: 'SKU',
        quantity: 'Quantity',
        purchasePrice: 'Purchase Price',
        totalValue: 'Total Value',
        createdAt: 'Created',
        status: 'Status',
        actions: 'Actions'
      },
      showDeleted: 'Show deleted',
      deletedChip: 'Deleted',
      deletedEmpty: 'No deleted products.',
      restore: 'Restore',
      restored: 'Product restored',
      restoreConflict: 'Cannot restore: a live product already uses this name or SKU.',
      delete: { action: 'Delete', title: 'Delete product', message: 'Delete "{{name}}"?' }
    }
  }
};

function pageWith(names: string[], totalElements = names.length): PaginatedProducts {
  return {
    content: names.map((name, index) => ({
      id: index + 1,
      name,
      sku: `SKU-${index}`,
      quantity: 10,
      purchasePrice: 99.5,
      totalValue: 995,
      createdAt: '2026-01-02T03:04:00'
    })),
    pageNumber: 0,
    pageSize: 10,
    totalElements,
    totalPages: 1
  };
}

function deletedProduct(id: number, name: string): ProductResponse {
  return {
    id,
    name,
    sku: `SKU-${id}`,
    quantity: 4,
    purchasePrice: 39,
    totalValue: 156,
    createdAt: '2026-01-02T03:04:00'
  };
}

class ProductServiceStub {
  calls: { page: number; size: number }[] = [];
  response: Observable<PaginatedProducts> = of(pageWith([]));
  removeCalls: number[] = [];
  removeResult: Observable<string> = of('Product deleted.');
  deletedCalls = 0;
  deletedResult: Observable<ProductResponse[]> = of([deletedProduct(7, 'Retired Bracket')]);
  restoreCalls: number[] = [];
  restoreResult: Observable<ProductResponse> = of(deletedProduct(7, 'Retired Bracket'));

  getPagedProducts(page: number, size: number): Observable<PaginatedProducts> {
    this.calls.push({ page, size });
    return this.response;
  }

  remove(id: number): Observable<string> {
    this.removeCalls.push(id);
    return this.removeResult;
  }

  getDeleted(): Observable<ProductResponse[]> {
    this.deletedCalls += 1;
    return this.deletedResult;
  }

  restore(id: number): Observable<ProductResponse> {
    this.restoreCalls.push(id);
    return this.restoreResult;
  }
}

class NotificationServiceStub {
  successes: string[] = [];
  errors: string[] = [];

  success(message: string): void {
    this.successes.push(message);
  }

  error(message: string): void {
    this.errors.push(message);
  }
}

class MatDialogStub {
  confirmed: boolean | undefined = true;

  open() {
    return { afterClosed: () => of(this.confirmed) };
  }
}

describe('ProductListComponent', () => {
  let fixture: ComponentFixture<ProductListComponent>;
  let stub: ProductServiceStub;
  let notifications: NotificationServiceStub;
  let dialog: MatDialogStub;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** The menu renders into an overlay only once its trigger is clicked. */
  async function openRowMenu(rowIndex = 0): Promise<void> {
    host().querySelectorAll<HTMLButtonElement>('.product-actions')[rowIndex].click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function menuItem(selector: string): HTMLButtonElement | null {
    return document.querySelector<HTMLButtonElement>(selector);
  }

  async function setUp(
    response: Observable<PaginatedProducts>,
    role: 'ADMIN' | 'USER' = 'ADMIN'
  ): Promise<void> {
    stub = new ProductServiceStub();
    stub.response = response;
    notifications = new NotificationServiceStub();
    dialog = new MatDialogStub();

    await TestBed.configureTestingModule({
      imports: [ProductListComponent],
      providers: [
        provideRouter([]),
        provideTestTranslations(TRANSLATIONS),
        { provide: ProductService, useValue: stub },
        { provide: NotificationService, useValue: notifications },
        { provide: MatDialog, useValue: dialog },
        { provide: AuthService, useValue: { role: () => role } }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(ProductListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
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

  it('delete_rejected_surfacesErrorNotification', async () => {
    await setUp(of(pageWith(['Laptop'])), 'ADMIN');
    dialog.confirmed = true;
    stub.removeResult = throwError(() => new Error('Product cannot be deleted.'));

    await openRowMenu();
    menuItem('.product-delete')?.click();
    await fixture.whenStable();

    expect(notifications.errors).toEqual(['Product cannot be deleted.']);
  });

  /** Flips the "Show deleted" toggle, which only an admin can reach. */
  async function toggleDeleted(): Promise<void> {
    host().querySelector<HTMLElement>('.product-show-deleted button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

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
