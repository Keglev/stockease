import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LanguageService } from '../../../../core/i18n/language.service';
import { provideFakeChartEngine } from '../../../../testing/chart-testing';
import { provideTestTranslations } from '../../../../testing/i18n-testing';
import { AnalyticsCardComponent } from './analytics-card.component';

const TRANSLATIONS = {
  en: {
    reports: {
      stock: { empty: 'No products are currently in stock.' },
      analytics: {
        selectProduct: 'Select a product to analyze',
        priceHistory: 'Purchase price over time',
        stockVsSales: 'Stock level vs. units sold',
        noPriceChanges: 'No price changes recorded.'
      }
    }
  }
};

/*
 * The analytics tab's body below the period toggle, as a card: the prompt that stands in until a
 * product is actually shown, and the two series charted for it once one is.
 * Out of scope: the picker and the Show button that decide what `shown` means, the fetches behind
 * the two options, and the loading bar the tab raises and lowers - all of which stay with the page
 * and are covered by reports-page.analytics.spec.ts; and the chart wrapper
 * (chart.component.spec.ts).
 * Siblings: cash-flow-card.component.spec.ts, profit-card.component.spec.ts,
 * changes-card.component.spec.ts, losses-card.component.spec.ts, stock-card.component.spec.ts,
 * due-dates-card.component.spec.ts, period-toggle.component.spec.ts,
 * report-view-toggle.component.spec.ts and supplier-product-picker.component.spec.ts are the
 * reports page's other extracted pieces.
 */
describe('AnalyticsCardComponent', () => {
  let fixture: ComponentFixture<AnalyticsCardComponent>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /* Renders the card; every input the template reads is set here. */
  async function render(overrides: Record<string, unknown> = {}): Promise<void> {
    const inputs: Record<string, unknown> = {
      shown: true, priceOption: { series: [] }, stockOption: { series: [] }, ...overrides
    };
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await settle();
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [AnalyticsCardComponent],
      providers: [provideTestTranslations(TRANSLATIONS), provideFakeChartEngine()]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(AnalyticsCardComponent);
  });

  it('gate_nothingShown_rendersThePromptAndNoCharts', async () => {
    await render({ shown: false });

    // Keyed on what is shown rather than what is picked: the options can already be populated from
    // a previous product and this must still be the prompt.
    expect(host().querySelector('.analytics-prompt')).not.toBeNull();
    expect(host().querySelector('app-chart')).toBeNull();
  });

  it('gate_productShown_drawsBothSeriesAndDropsThePrompt', async () => {
    await render();

    expect(host().querySelector('.analytics-prompt')).toBeNull();
    expect(host().querySelectorAll('app-chart').length).toBe(2);
  });

  it('priceChart_nullOption_showsItsOwnEmptyStateAndKeepsTheStockChart', async () => {
    await render({ priceOption: null });

    // One price is a fact, not a history - and that is different news from having no stock movement.
    expect(host().querySelector('.analytics-no-prices')).not.toBeNull();
    expect(host().querySelector('.analytics-no-stock')).toBeNull();
    expect(host().querySelectorAll('app-chart').length).toBe(1);
  });

  it('stockChart_nullOption_showsItsOwnEmptyStateAndKeepsThePriceChart', async () => {
    await render({ stockOption: null });

    expect(host().querySelector('.analytics-no-stock')).not.toBeNull();
    expect(host().querySelector('.analytics-no-prices')).toBeNull();
    expect(host().querySelectorAll('app-chart').length).toBe(1);
  });

  it('bothCharts_nullOptions_showBothEmptyStates', async () => {
    await render({ priceOption: null, stockOption: null });

    // The two cards answer independently, so a shown product with neither series still explains
    // itself twice rather than going blank.
    expect(host().querySelector('.analytics-no-prices')).not.toBeNull();
    expect(host().querySelector('.analytics-no-stock')).not.toBeNull();
  });
});
