import { Signal, WritableSignal, signal } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { Observable } from 'rxjs';

export const DEFAULT_PAGE_SIZE = 10;

/** The state and behaviour a list page shares when the server hands it one page at a time. */
export interface PagedListStore<T> {
  readonly rows: Signal<T[]>;
  /** The server's count of the whole result, which is what the paginator's length means here. */
  readonly totalElements: Signal<number>;
  readonly pageIndex: Signal<number>;
  readonly pageSize: Signal<number>;
  readonly loading: WritableSignal<boolean>;
  readonly error: WritableSignal<string | null>;
  onPage(event: PageEvent): void;
  load(): void;
}

/**
 * Builds the paging and load state for a list page whose pages come from the server.
 *
 * @remarks
 * The sibling {@link createListPageStore} fetches a register whole and slices it in memory. This
 * one asks the server for the page it needs, so `onPage` refetches where the sibling recomputes,
 * and `totalElements` comes off the response because the client never holds enough rows to count
 * it. Which store a page wants follows from where its pages come from (ADR 040).
 *
 * `loading` and `error` are writable, where the sibling exposes them readonly. On these pages they
 * are the one progress bar and the one error banner the page has, and work other than a page load
 * writes to them: the invoice ledger's CSV export puts its failure in the same banner rather than
 * introducing a notification channel the page does not otherwise have, and the product catalogue
 * hands both signals to a page-level collaborator. Making them readonly here would push those
 * callers into keeping a second flag and a second banner for the same two states.
 *
 * The caller supplies `fetch` rather than a service, so the store stays free of any one feature's
 * API and can be given a stub directly in a spec. Its page shape is structural for the same
 * reason: every paged endpoint in this app answers with `content` and `totalElements`, and naming
 * the response types here would tie the store to the API models of whichever features use it.
 *
 * There is deliberately no page-index clamping, which the sibling does have. Clamping needs the
 * total before it can decide where to land, and the total only arrives with the response that the
 * out-of-range request already returned - so the correct behaviour is a question about refetching,
 * not a slice adjustment (ADR 040).
 */
export function createPagedListStore<T>(
  fetch: (pageIndex: number, pageSize: number) => Observable<{ content: T[]; totalElements: number }>
): PagedListStore<T> {
  const rows = signal<T[]>([]);
  const totalElements = signal(0);
  const pageIndex = signal(0);
  const pageSize = signal(DEFAULT_PAGE_SIZE);
  const loading = signal(false);
  const error = signal<string | null>(null);

  function load(): void {
    loading.set(true);
    error.set(null);

    fetch(pageIndex(), pageSize()).subscribe({
      next: (page) => {
        rows.set(page.content);
        totalElements.set(page.totalElements);
        loading.set(false);
      },
      // A failed load drops the rows and the total together: rows left on screen beside an error
      // message read as though they answered the failed request, and a total outliving them would
      // leave the paginator offering pages that no longer have anything behind them.
      error: (err: Error) => {
        rows.set([]);
        totalElements.set(0);
        error.set(err.message);
        loading.set(false);
      }
    });
  }

  function onPage(event: PageEvent): void {
    pageIndex.set(event.pageIndex);
    pageSize.set(event.pageSize);
    // Server paging: the rows for the new page are not in hand, so this refetches where the
    // in-memory sibling would recompute a slice.
    load();
  }

  return {
    rows: rows.asReadonly(),
    totalElements: totalElements.asReadonly(),
    pageIndex: pageIndex.asReadonly(),
    pageSize: pageSize.asReadonly(),
    loading,
    error,
    onPage,
    load
  };
}
