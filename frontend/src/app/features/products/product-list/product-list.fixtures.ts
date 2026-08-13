import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';

import { PaginatedProducts, ProductResponse } from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { ProductService } from '../product.service';
import { ProductListComponent } from './product-list.component';

/*
 * Fixtures shared by the product-list specs, held here under the shared-fixture rule because two
 * spec files consume them.
 *
 * Constants, pure builders, stubs, DOM readers and the shared TestBed configuration only. No
 * beforeEach, afterEach, or any other hook registration belongs here: hooks registered outside a
 * describe block have been observed not to run for every spec under coverage, so a hook placed here
 * would silently protect nothing. Nor does any `vi.*` call or `node:` import: this module is not a
 * spec, so it is compiled by tsconfig.app.json, which declares no types at all.
 */
export const TRANSLATIONS = {
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
      empty: 'No products found.',
      loading: 'Loading products…',
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

export function pageWith(names: string[], totalElements = names.length): PaginatedProducts {
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

export function deletedProduct(id: number, name: string): ProductResponse {
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

export class ProductServiceStub {
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

export class NotificationServiceStub {
  successes: string[] = [];
  errors: string[] = [];

  success(message: string): void {
    this.successes.push(message);
  }

  error(message: string): void {
    this.errors.push(message);
  }
}

/*
 * Stands in for MatDialog. The confirm dialog answers with `confirmed`; the create and edit dialogs
 * answer with `saved`, and every call is recorded so a spec can name which one was opened with what.
 */
export class MatDialogStub {
  confirmed: boolean | undefined = true;
  saved: ProductResponse | undefined = undefined;
  openCalls: { component: unknown; config?: { data?: unknown } }[] = [];

  open(component: unknown, config?: { data?: unknown }) {
    this.openCalls.push({ component, config });
    const answer = component === ConfirmDialogComponent ? this.confirmed : this.saved;
    return { afterClosed: () => of(answer) };
  }
}

/** The rendered page and the stubs a spec drives it through. */
export interface ProductListHarness {
  fixture: ComponentFixture<ProductListComponent>;
  stub: ProductServiceStub;
  notifications: NotificationServiceStub;
  dialog: MatDialogStub;
}

/**
 * Builds the catalogue over the given paged response and role, and answers with it and the stubs
 * it was wired with.
 *
 * <p>One function rather than a copy per spec file, so the runner sees one context configuration
 * across both of them: a difference here would fork the compilation the specs share.
 */
export async function configureProductListTestBed(
  response: Observable<PaginatedProducts>,
  role: 'ADMIN' | 'USER' = 'ADMIN'
): Promise<ProductListHarness> {
  // The entry clear for both consumers of this fixture, which is how each of them meets the
  // storage-isolation rule without repeating it.
  localStorage.clear();
  TestBed.resetTestingModule();

  const stub = new ProductServiceStub();
  stub.response = response;
  const notifications = new NotificationServiceStub();
  const dialog = new MatDialogStub();

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

  const fixture = TestBed.createComponent(ProductListComponent);
  fixture.detectChanges();
  await fixture.whenStable();

  return { fixture, stub, notifications, dialog };
}

export function host(fixture: ComponentFixture<ProductListComponent>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

/* The menu renders into an overlay only once its trigger is clicked. */
export async function openRowMenu(
  fixture: ComponentFixture<ProductListComponent>,
  rowIndex = 0
): Promise<void> {
  host(fixture).querySelectorAll<HTMLButtonElement>('.product-actions')[rowIndex].click();
  fixture.detectChanges();
  await fixture.whenStable();
}

export function menuItem(selector: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(selector);
}
