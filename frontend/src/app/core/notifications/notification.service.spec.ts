import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';

import { LANGUAGE_STORAGE_KEY, LanguageService } from '../i18n/language.service';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { NotificationService } from './notification.service';

const TRANSLATIONS = {
  en: {
    products: {
      created: 'Product created.',
      restoreConflict: 'Cannot restore: a live product already uses this name or SKU.'
    }
  },
  // German carries a distinct string on purpose: with the same text in both dictionaries the
  // language-switch test below would pass whether or not the language was ever consulted.
  de: {
    products: {
      created: 'Produkt wurde angelegt.',
      restoreConflict: 'Wiederherstellen nicht möglich.'
    }
  }
};

/* Records what the service asked Material to show, without rendering a snack bar. */
class MatSnackBarStub {
  calls: { message: string; action: string | undefined; config: unknown }[] = [];

  open(message: string, action: string | undefined, config: unknown): void {
    this.calls.push({ message, action, config });
  }
}

describe('NotificationService', () => {
  let service: NotificationService;
  let snackBar: MatSnackBarStub;

  function lastCall() {
    return snackBar.calls[snackBar.calls.length - 1];
  }

  beforeEach(() => {
    // Pinned, not merely cleared: the service resolves messages through TranslateService, so the
    // asserted text depends on the active language (#136).
    localStorage.clear();
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    TestBed.resetTestingModule();
    snackBar = new MatSnackBarStub();

    TestBed.configureTestingModule({
      providers: [provideTestTranslations(TRANSLATIONS), { provide: MatSnackBar, useValue: snackBar }]
    });

    TestBed.inject(LanguageService).initialize().subscribe();
    service = TestBed.inject(NotificationService);
  });

  it('success_translationKey_opensSnackBarWithTranslatedTextAndSuccessConfig', () => {
    service.success('products.created');

    expect(lastCall().message).toBe('Product created.');
    // No action button by design: these are acknowledgements, not prompts.
    expect(lastCall().action).toBeUndefined();
    expect(lastCall().config).toEqual({ duration: 3000, panelClass: 'notification-success' });
  });

  it('error_translationKey_opensSnackBarWithErrorConfig', () => {
    service.error('products.restoreConflict');

    expect(lastCall().message).toBe('Cannot restore: a live product already uses this name or SKU.');
    // Errors linger longer than successes - 5s against 3s - because they carry something to act on.
    expect(lastCall().config).toEqual({ duration: 5000, panelClass: 'notification-error' });
  });

  it('success_backendSentence_isShownVerbatimRatherThanAsAKey', () => {
    // Backend messages arrive untranslated by design. The defect this guards: echoing the input
    // back only looks correct here, so the assertion also pins that it was NOT turned into a key.
    service.success('Product with ID 1 has been successfully deleted.');

    expect(lastCall().message).toBe('Product with ID 1 has been successfully deleted.');
  });

  it('error_unknownDottedKey_isShownVerbatimRatherThanEchoingTheKey', () => {
    // A dotted string that no dictionary defines is the ambiguous case: ngx-translate returns the
    // key unchanged, and the service must treat that as "not a key" instead of displaying it.
    service.error('products.noSuchKey');

    expect(lastCall().message).toBe('products.noSuchKey');
  });

  it('success_keyResolvingToANestedNode_isShownVerbatimRatherThanAnObject', () => {
    // `products` resolves to the whole sub-dictionary, so instant() returns an object. Without the
    // typeof guard the snack bar would receive "[object Object]".
    service.success('products');

    expect(lastCall().message).toBe('products');
  });

  it('success_languageSwitchedAfterInjection_resolvesInTheNewLanguage', () => {
    service.success('products.created');
    expect(lastCall().message).toBe('Product created.');

    TestBed.inject(LanguageService).setLanguage('de');
    service.success('products.created');

    // Resolution happens per call, not once at construction: the same key shown twice across a
    // language switch must produce two different strings.
    expect(lastCall().message).toBe('Produkt wurde angelegt.');
  });
});
