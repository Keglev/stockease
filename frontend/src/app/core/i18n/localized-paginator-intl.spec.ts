import { TestBed } from '@angular/core/testing';
import { MatPaginatorIntl } from '@angular/material/paginator';

import { provideTestTranslations } from '../../testing/i18n-testing';
import { LanguageService } from './language.service';
import { LocalizedPaginatorIntl } from './localized-paginator-intl';

const TRANSLATIONS = {
  en: {
    common: {
      paginator: {
        itemsPerPage: 'Items per page:',
        firstPage: 'First page',
        previousPage: 'Previous page',
        nextPage: 'Next page',
        lastPage: 'Last page',
        range: '{{start}} - {{end}} of {{total}}',
        rangeEmpty: '0 of {{total}}'
      }
    }
  },
  de: {
    common: {
      paginator: {
        itemsPerPage: 'Einträge pro Seite:',
        firstPage: 'Erste Seite',
        previousPage: 'Vorherige Seite',
        nextPage: 'Nächste Seite',
        lastPage: 'Letzte Seite',
        range: '{{start}} - {{end}} von {{total}}',
        rangeEmpty: '0 von {{total}}'
      }
    }
  }
};

/*
 * The paginator's labels, which Material ships hardcoded in English: that each one resolves from a
 * translation key, that the range label interpolates the slice it reports, and that a language
 * switch both re-resolves the labels and announces itself, since a rendered paginator repaints from
 * that announcement and not from the properties changing.
 * Out of scope: how the four list pages page their data, and the paginator component itself - this
 * covers the strings it is given, not what it does with them.
 */
describe('LocalizedPaginatorIntl', () => {
  let intl: LocalizedPaginatorIntl;
  let language: LanguageService;

  /* Switches the app language the way the language menu does, and settles the emission. */
  async function switchTo(lang: string): Promise<void> {
    language.setLanguage(lang);
    await Promise.resolve();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: MatPaginatorIntl, useClass: LocalizedPaginatorIntl }
      ]
    });

    language = TestBed.inject(LanguageService);
    language.initialize().subscribe();
    intl = TestBed.inject(MatPaginatorIntl) as LocalizedPaginatorIntl;
  });

  it('labels_defaultLanguage_resolveFromTheirKeys', () => {
    expect(intl.itemsPerPageLabel).toBe('Items per page:');
    expect(intl.firstPageLabel).toBe('First page');
    expect(intl.previousPageLabel).toBe('Previous page');
    expect(intl.nextPageLabel).toBe('Next page');
    expect(intl.lastPageLabel).toBe('Last page');
  });

  it('rangeLabel_middlePage_countsFromOneAndNamesTheTotal', () => {
    // Page 1 of a 10-row page size over 42 rows: the reader counts from one, the code from zero.
    expect(intl.getRangeLabel(1, 10, 42)).toBe('11 - 20 of 42');
  });

  it('rangeLabel_lastPartialPage_stopsAtTheTotalRatherThanThePageSize', () => {
    expect(intl.getRangeLabel(4, 10, 42)).toBe('41 - 42 of 42');
  });

  it('rangeLabel_emptyList_statesTheCountInsteadOfAnEmptySlice', () => {
    // "0 - 0 of 0" would describe a slice nobody asked for; the count is the only fact there is.
    expect(intl.getRangeLabel(0, 10, 0)).toBe('0 of 0');
  });

  it('languageSwitched_labels_reResolveInTheNewLanguage', async () => {
    await switchTo('de');

    expect(intl.itemsPerPageLabel).toBe('Einträge pro Seite:');
    expect(intl.nextPageLabel).toBe('Nächste Seite');
    expect(intl.getRangeLabel(1, 10, 42)).toBe('11 - 20 von 42');
  });

  it('languageSwitched_changes_emitsSoRenderedPaginatorsRepaint', async () => {
    let announced = 0;
    intl.changes.subscribe(() => announced++);

    await switchTo('de');

    // A paginator reads these properties once per render, so the new strings reach the screen only
    // because this fires.
    expect(announced).toBe(1);
  });
});
