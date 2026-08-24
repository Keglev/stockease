import { Signal, computed, signal } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { Observable } from 'rxjs';

const DEFAULT_PAGE_SIZE = 10;

/** The state and behaviour a register page shares: fetch once, hold the rows, page over them. */
export interface ListPageStore<T> {
  readonly rows: Signal<T[]>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<string | null>;
  readonly pageIndex: Signal<number>;
  readonly pageSize: Signal<number>;
  /** The slice the table renders: the current page of `rows`, computed rather than refetched. */
  readonly visibleRows: Signal<T[]>;
  onPage(event: PageEvent): void;
  load(): void;
}

/**
 * Builds the paging and load state for a register page that holds its whole list in memory.
 *
 * @remarks
 * Paging is client-side by design. These registers are bounded master data, and the page has the
 * full array in hand anyway because its dialogs and its delete guard read from it - so a paged
 * endpoint would buy a round trip per page without taking any work off the client. The invoice
 * ledger is where server-side paging earns its cost, and it does not use this store.
 *
 * A failed load empties the rows rather than leaving the previous ones on screen beside an error
 * message, which would read as though the stale rows were the answer. A successful load pulls the
 * page index back when the rows behind it are gone: deleting the last row of the last page would
 * otherwise strand the table on a page that no longer exists, showing nothing and giving no hint
 * that the data moved.
 *
 * The caller supplies `fetch` rather than a service, so the store stays free of any one feature's
 * API and can be given a stub directly in a spec.
 *
 * `resolveMessage` turns a failure into the sentence to show. It is required rather than
 * defaulted, and deliberately so: a default that rendered `err.message` would work everywhere and
 * be wrong on any page whose endpoint names its refusals, which is how surfaces were found showing
 * English after their endpoints gained codes. Requiring it makes the choice visible at every call
 * site. The type is a plain function, so the store stays free of i18n and of the error vocabulary
 * and a spec can hand it any function at all.
 */
export function createListPageStore<T>(
  fetch: () => Observable<T[]>,
  resolveMessage: (error: Error) => string
): ListPageStore<T> {
  const rows = signal<T[]>([]);
  const pageIndex = signal(0);
  const pageSize = signal(DEFAULT_PAGE_SIZE);
  const loading = signal(false);
  const error = signal<string | null>(null);

  const visibleRows = computed(() => {
    const start = pageIndex() * pageSize();
    return rows().slice(start, start + pageSize());
  });

  function clampPageIndex(): void {
    const lastPage = Math.max(0, Math.ceil(rows().length / pageSize()) - 1);
    if (pageIndex() > lastPage) {
      pageIndex.set(lastPage);
    }
  }

  function load(): void {
    loading.set(true);
    error.set(null);

    fetch().subscribe({
      next: (loaded) => {
        rows.set(loaded);
        clampPageIndex();
        loading.set(false);
      },
      error: (err: Error) => {
        rows.set([]);
        error.set(resolveMessage(err));
        loading.set(false);
      }
    });
  }

  function onPage(event: PageEvent): void {
    pageIndex.set(event.pageIndex);
    pageSize.set(event.pageSize);
  }

  return {
    rows: rows.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    pageIndex: pageIndex.asReadonly(),
    pageSize: pageSize.asReadonly(),
    visibleRows,
    onPage,
    load
  };
}
