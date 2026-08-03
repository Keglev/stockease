import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ProductProfitReport } from '../../../core/api/api-models';
import { LANGUAGE_STORAGE_KEY, LanguageService } from '../../../core/i18n/language.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { ProfitDetailDialogComponent } from './profit-detail-dialog.component';

const TRANSLATIONS = {
  en: {
    common: { close: 'Close' },
    reports: {
      deletedHint: 'deleted',
      columns: { sku: 'SKU', revenue: 'Revenue', cost: 'Cost', grossProfit: 'Gross profit' }
    }
  }
};

const DETAIL: ProductProfitReport = {
  productId: 3,
  name: 'Widget',
  sku: 'SKU-3',
  deleted: false,
  revenue: 100,
  cost: 40,
  grossProfit: 60
};

describe('ProfitDetailDialogComponent', () => {
  let fixture: ComponentFixture<ProfitDetailDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function textOf(selector: string): string {
    return host().querySelector(selector)?.textContent?.trim() ?? '';
  }

  async function setUp(detail: ProductProfitReport = DETAIL): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ProfitDetailDialogComponent],
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: detail }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(ProfitDetailDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    // Cleared and pinned, not merely cleared: LanguageService resolves from storage first, so
    // without this the rendered currency would depend on whichever spec file ran before this one.
    localStorage.clear();
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    TestBed.resetTestingModule();
    dialogRef = { close: vi.fn() };
  });

  it('render_dialogData_showsEveryFigure', async () => {
    await setUp();

    expect(textOf('h2')).toBe('Widget');
    expect(textOf('.detail-sku')).toBe('SKU-3');
    // Whole rendered amounts rather than substrings of the digits: with the language pinned above
    // this pins the currency format too, which a bare "100" assertion would not.
    expect(textOf('.detail-revenue')).toBe('€100.00');
    expect(textOf('.detail-cost')).toBe('€40.00');
    expect(textOf('.detail-gross-profit')).toBe('€60.00');
  });

  it('render_germanLanguage_formatsAmountsGerman', async () => {
    await setUp();

    TestBed.inject(LanguageService).setLanguage('de');
    fixture.detectChanges();

    // The dialog renders through AppCurrencyPipe, so a format override has to reach it (#136).
    // Normalised on code points: which no-break space Intl emits before the symbol varies by ICU
    // version, and this assertion is about the currency format rather than about that.
    const text = [...(host().textContent ?? '')]
      .map((ch) => ([0xa0, 0x202f].includes(ch.codePointAt(0) ?? 0) ? ' ' : ch))
      .join('');
    expect(text).toContain('100,00 €');
    expect(text).not.toContain('€100.00');
  });

  it('render_lossMakingProduct_showsNegativeGrossProfit', async () => {
    await setUp({ ...DETAIL, revenue: 30, cost: 50, grossProfit: -20 });

    // A loss is real data, not an error state: the dialog must render it rather than blank the
    // field, and the sign is the whole point of the row.
    expect(textOf('.detail-gross-profit')).toBe('-€20.00');
  });

  it('render_productWithNoSales_showsZeroFigures', async () => {
    await setUp({ ...DETAIL, revenue: 0, cost: 0, grossProfit: 0 });

    // Zero is data here too: a product that never sold gets a real, zero-filled detail.
    expect(textOf('.detail-revenue')).toBe('€0.00');
    expect(textOf('.detail-gross-profit')).toBe('€0.00');
  });

  it('render_deletedProduct_showsDeletedHint', async () => {
    await setUp({ ...DETAIL, deleted: true });

    // Soft-deleted products still appear in profit history, so the dialog says so rather than
    // pretending the row is live.
    expect(textOf('.detail-deleted')).toBe('deleted');
  });

  it('render_liveProduct_omitsDeletedHint', async () => {
    await setUp();

    expect(host().querySelector('.detail-deleted')).toBeNull();
  });

  it('close_clicked_closesTheDialog', async () => {
    await setUp();

    host().querySelector<HTMLButtonElement>('.detail-close')?.click();

    // The dialog is a pure presenter: closing is the only action it owns.
    expect(dialogRef.close).toHaveBeenCalled();
  });
});
