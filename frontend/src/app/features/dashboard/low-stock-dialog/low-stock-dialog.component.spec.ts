import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';

import { ProductResponse } from '../../../core/api/api-models';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { LowStockDialogComponent, LowStockDialogData } from './low-stock-dialog.component';

const TRANSLATIONS = {
  en: {
    common: { close: 'Close' },
    dashboard: {
      lowStockTitle: 'Low stock',
      lowStockNone: 'All products are sufficiently stocked.'
    }
  }
};

const WIDGET: ProductResponse = {
  id: 3,
  name: 'Widget',
  sku: 'SKU-3',
  quantity: 2,
  purchasePrice: 15,
  totalValue: 30,
  createdAt: '2026-01-02T03:04:00'
};

const GADGET: ProductResponse = { ...WIDGET, id: 4, name: 'Gadget', sku: 'SKU-4', quantity: 0 };

/*
 * A pure presenter: it lists the rows it was handed, links each to the products page, closes on
 * navigation, and shows an empty state when there are none.
 * Out of scope: fetching those rows, which the dashboard did before opening this
 * (dashboard.component.spec.ts).
 */
describe('LowStockDialogComponent', () => {
  let fixture: ComponentFixture<LowStockDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  function render(products: ProductResponse[]): void {
    const data: LowStockDialogData = { products };
    TestBed.resetTestingModule();
    dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        // A real target for the row's link, so the navigation the click starts can finish rather
        // than failing against an empty route table after the fixture is gone.
        provideRouter([{ path: 'app/products', children: [] }]),
        provideTestTranslations(TRANSLATIONS),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef }
      ]
    });
    fixture = TestBed.createComponent(LowStockDialogComponent);
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('render_rows_showsNameSkuQuantity', () => {
    render([WIDGET, GADGET]);

    const rows = host().querySelectorAll('.low-stock-row');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.low-stock-name')?.textContent).toContain('Widget');
    expect(rows[0].querySelector('.low-stock-sku')?.textContent).toContain('SKU-3');
    expect(rows[0].querySelector('.low-stock-quantity')?.textContent).toContain('2');
  });

  it('rowNavigation_click_closesDialog', async () => {
    render([WIDGET]);

    // the row navigates away from the dashboard, and a dialog left open over the next page is noise
    host().querySelector<HTMLAnchorElement>('.low-stock-name')?.click();
    // the routed navigation the click also starts resolves before the fixture is torn down
    await fixture.whenStable();

    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });

  it('rowNavigation_link_pointsAtTheProductsPage', () => {
    render([WIDGET]);

    // the target the retired card's rows carried, preserved rather than reinvented
    expect(host().querySelector('.low-stock-name')?.getAttribute('href')).toBe('/app/products');
  });

  it('render_empty_showsEmptyState', () => {
    render([]);

    expect(host().querySelector('.low-stock-row')).toBeNull();
    expect(host().querySelector('.low-stock-none')?.textContent)
      .toContain('All products are sufficiently stocked.');
  });
});
