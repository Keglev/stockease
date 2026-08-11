import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Observable, of } from 'rxjs';

import { SupplierProduct, SupplierResponse } from '../../../../core/api/api-models';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TypeaheadComponent } from '../../../../shared/typeahead/typeahead.component';
import { provideTestTranslations } from '../../../../testing/i18n-testing';
import { SupplierProductPickerComponent } from './supplier-product-picker.component';

const TRANSLATIONS = {
  en: {
    common: { search: { noMatches: 'No matches' } },
    reports: { search: { supplier: 'Search supplier', product: 'Search product' } }
  }
};

const ACME: SupplierResponse = {
  id: 5, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: ''
};

const WIDGET: SupplierProduct = {
  id: 3, name: 'Widget', sku: 'SKU-3', quantity: 1, purchasePrice: 1, totalValue: 1, createdAt: ''
};

/*
 * The cascading supplier-then-product pair, as a control: it renders both fields, honours the
 * disabled state the tab computes for the product field, announces each pick, and empties the
 * product field whenever a supplier is chosen - the one rule the pair owns rather than the tab.
 * Out of scope: what a pick is worth (a refetch on the cash-flow tab, a Show gate on the analytics
 * one) and which products the search can offer, both of which stay with the tab and are covered by
 * reports-page.cash-flow.spec.ts and reports-page.analytics.spec.ts; and the search-as-you-type
 * behaviour itself, which is typeahead.component.spec.ts.
 * Siblings: period-toggle.component.spec.ts and report-view-toggle.component.spec.ts are the
 * reports page's other extracted controls.
 */
describe('SupplierProductPickerComponent', () => {
  let fixture: ComponentFixture<SupplierProductPickerComponent>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /* The field at a class, reached as a component so its output can be emitted as the user's pick. */
  function fieldAt(selector: string): TypeaheadComponent<never> {
    return fixture.debugElement.query(By.css(selector)).componentInstance as TypeaheadComponent<never>;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [SupplierProductPickerComponent],
      providers: [provideTestTranslations(TRANSLATIONS)]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(SupplierProductPickerComponent);
    const ref = fixture.componentRef;
    ref.setInput('supplierSearch', (): Observable<SupplierResponse[]> => of([ACME]));
    ref.setInput('productSearch', (): Observable<SupplierProduct[]> => of([WIDGET]));
    ref.setInput('supplierLabel', (supplier: SupplierResponse) => supplier.name);
    ref.setInput('productLabel', (product: SupplierProduct) => product.name);
    await settle();
  });

  it('render_default_showsTheSupplierFieldThenTheProductField', () => {
    // Left to right in the order they must be filled; the cascade is what the pair exists for.
    const labels = Array.from(host().querySelectorAll('mat-label')).map((l) => l.textContent?.trim());
    expect(labels).toEqual(['Search supplier', 'Search product']);
  });

  it('render_productDisabledInput_disablesTheProductFieldOnly', async () => {
    fixture.componentRef.setInput('productDisabled', true);
    await settle();

    expect(host().querySelector<HTMLInputElement>('.product-search input')?.disabled).toBe(true);
    expect(host().querySelector<HTMLInputElement>('.supplier-search input')?.disabled).toBe(false);
  });

  it('supplierField_selectionEmitted_forwardsItToTheCaller', async () => {
    const emitted: (SupplierResponse | null)[] = [];
    fixture.componentInstance.supplierSelected.subscribe((value) => emitted.push(value));

    fieldAt('.supplier-search').selected.emit(ACME as never);
    await settle();

    expect(emitted).toEqual([ACME]);
  });

  it('productField_selectionEmitted_forwardsItToTheCaller', async () => {
    const emitted: (SupplierProduct | null)[] = [];
    fixture.componentInstance.productSelected.subscribe((value) => emitted.push(value));

    fieldAt('.product-search').selected.emit(WIDGET as never);
    await settle();

    expect(emitted).toEqual([WIDGET]);
  });

  it('supplierField_selectionEmitted_emptiesTheProductFieldAndClearsItThroughTheOutput', async () => {
    const products: (SupplierProduct | null)[] = [];
    fixture.componentInstance.productSelected.subscribe((value) => products.push(value));
    fieldAt('.product-search').selected.emit(WIDGET as never);
    // Typed rather than assigned, so the field's own term is what the reset has to empty.
    const input = host().querySelector<HTMLInputElement>('.product-search input');
    input!.value = 'Widget';
    input!.dispatchEvent(new Event('input'));
    await settle();

    fieldAt('.supplier-search').selected.emit(ACME as never);
    await settle();

    // The coupling this component exists to own: a product picked under the previous supplier is
    // wiped, and the null leaves by the same output a user-cleared field uses - so the tab's own
    // guard is the only thing that decides what the clearing means.
    expect(products).toEqual([WIDGET, null]);
    expect(host().querySelector<HTMLInputElement>('.product-search input')?.value).toBe('');
  });
});
