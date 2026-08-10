import { Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';

import { FormatService } from '../../core/format/format.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ChartContext, createChartContext } from './chart-context';

/*
 * Stands in for the three services the context reads. The signals are the point: they are what a
 * language or format switch actually moves, and what the derivation has to be tracking.
 */
class LanguageServiceStub {
  readonly currentLang = signal('en');
}

class FormatServiceStub {
  readonly numberLocale = signal('en-GB');
  readonly dateFormat = signal('dmyDot');
  readonly numberFormat = signal('en');

  formatCurrency(value: number): string {
    return `${this.numberLocale()}:${value}`;
  }
  formatNumber(value: number): string {
    return String(value);
  }
  formatDate(value: string): string {
    return value;
  }
  formatMonth(value: string): string {
    return value;
  }
  formatPercent(value: number): string {
    return String(value);
  }
}

class TranslateServiceStub {
  instant(key: string): string {
    return key;
  }
}

/*
 * The chart context is a dependency, so what matters is when it REBUILDS: a chart option that
 * reads it must be invalidated by a language switch and by a format switch, and must not be
 * invalidated by nothing at all.
 * Out of scope: what the options built from it look like - the pages that own those charts.
 */
describe('createChartContext', () => {
  let language: LanguageServiceStub;
  let format: FormatServiceStub;

  function setUp(): Signal<ChartContext> {
    language = new LanguageServiceStub();
    format = new FormatServiceStub();
    TestBed.configureTestingModule({
      providers: [
        { provide: LanguageService, useValue: language },
        { provide: FormatService, useValue: format },
        { provide: TranslateService, useValue: new TranslateServiceStub() }
      ]
    });
    return TestBed.runInInjectionContext(() => createChartContext());
  }

  it('read_languageChanged_rebuildsTheContext', () => {
    const context = setUp();
    const before = context();

    language.currentLang.set('de');

    // A new object is the whole contract: it is what invalidates every option derived from it,
    // which is what stops a translated label surviving the switch that should have replaced it.
    expect(context()).not.toBe(before);
    expect(context().language).toBe('de');
  });

  it('read_numberLocaleChanged_rebuildsTheContext', () => {
    const context = setUp();
    const before = context();

    format.numberLocale.set('de-DE');

    // ECharts calls the formatters while it paints, outside any reactive context, so this read has
    // to be registered here or a format switch never reaches the canvas.
    expect(context()).not.toBe(before);
    expect(context().format.currency(2)).toBe('de-DE:2');
  });

  it('read_nothingChanged_reusesTheSameContext', () => {
    // The other direction, so neither assertion above can pass on a context that rebuilds always.
    const context = setUp();

    expect(context()).toBe(context());
  });
});
