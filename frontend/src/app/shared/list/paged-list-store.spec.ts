import { Observable, of, throwError } from 'rxjs';

import { createPagedListStore } from './paged-list-store';

/*
 * The store takes a resolveMessage seam rather than rendering err.message itself, so these specs
 * hand it the identity of that seam: every case below is about paging and load state, and a
 * passthrough keeps their assertions about the message exactly what they were.
 */
const passthrough = (err: Error): string => err.message;

/* Builds one server page of the given size, numbered from the row the page starts at, so which
 * page a request asked for is readable in the assertions. */
function page(pageIndex: number, pageSize: number, totalElements: number) {
  const start = pageIndex * pageSize;
  const count = Math.max(0, Math.min(pageSize, totalElements - start));
  return {
    content: Array.from({ length: count }, (unused, index) => start + index),
    totalElements
  };
}

/*
 * The state a list page keeps while the server hands it one page at a time: what a load leaves
 * behind on success and on failure, and that a page change goes back to the server rather than
 * recomputing a slice it does not hold.
 * Out of scope: page-index clamping, which this store deliberately does not do (ADR 040); the
 * in-memory sibling - list-page-store.spec.ts; the pages that own a store - invoice-list specs.
 */
describe('createPagedListStore', () => {
  it('load_success_populatesRowsAndTotalAndClearsLoadingAndError', () => {
    const store = createPagedListStore(() => of(page(0, 10, 3)), passthrough);

    store.load();

    expect(store.rows()).toEqual([0, 1, 2]);
    expect(store.totalElements()).toBe(3);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('load_failure_reportsMessageAndEmptiesRowsAndTotal', () => {
    // Loads once successfully first, so the total has something to lose: asserting it is zero from
    // a store that never held rows would pass whether the failure path clears it or not.
    // The total goes with the rows - left behind, it would leave the paginator offering pages that
    // have nothing behind them any more.
    let fail = false;
    const store = createPagedListStore(() => (fail
      ? throwError(() => new Error('Backend unreachable'))
      : of(page(0, 10, 12))), passthrough);
    store.load();

    fail = true;
    store.load();

    expect(store.rows()).toEqual([]);
    expect(store.totalElements()).toBe(0);
    expect(store.error()).toBe('Backend unreachable');
    expect(store.loading()).toBe(false);
  });

  it('load_failure_reportsWhatResolveMessageReturnsRatherThanTheRawMessage', () => {
    // The seam is the point: the store must render what its caller's resolver returns, not the
    // error's own text. Marker strings rather than real sentences, because the claim is about
    // which of the two the store reaches for and not about any wording.
    const store = createPagedListStore(
      () => throwError(() => new Error('RAW-MESSAGE')),
      () => 'RESOLVED-MESSAGE'
    );

    store.load();

    expect(store.error()).toBe('RESOLVED-MESSAGE');
    expect(store.error()).not.toBe('RAW-MESSAGE');
  });

  it('load_afterAFailure_clearsTheMessageOnTheNextAttempt', () => {
    let fail = true;
    const store = createPagedListStore(() => (fail
      ? throwError(() => new Error('Backend unreachable'))
      : of(page(0, 10, 2))), passthrough);
    store.load();

    fail = false;
    store.load();

    expect(store.error()).toBeNull();
    expect(store.rows()).toEqual([0, 1]);
  });

  it('onPage_secondPage_refetchesWithTheNewIndexAndSize', () => {
    const asked: { pageIndex: number; pageSize: number }[] = [];
    const store = createPagedListStore((pageIndex, pageSize) => {
      asked.push({ pageIndex, pageSize });
      return of(page(pageIndex, pageSize, 12));
    }, passthrough);
    store.load();

    store.onPage({ pageIndex: 1, pageSize: 10, length: 12 });

    expect(asked).toEqual([{ pageIndex: 0, pageSize: 10 }, { pageIndex: 1, pageSize: 10 }]);
    expect(store.rows()).toEqual([10, 11]);
  });

  it('onPage_largerPageSize_refetchesWithThatSize', () => {
    const asked: { pageIndex: number; pageSize: number }[] = [];
    const store = createPagedListStore((pageIndex, pageSize) => {
      asked.push({ pageIndex, pageSize });
      return of(page(pageIndex, pageSize, 12));
    }, passthrough);

    store.onPage({ pageIndex: 0, pageSize: 25, length: 12 });

    expect(asked).toEqual([{ pageIndex: 0, pageSize: 25 }]);
    expect(store.pageSize()).toBe(25);
    expect(store.rows().length).toBe(12);
  });

  it('load_pendingRequest_reportsLoadingUntilItAnswers', () => {
    // The progress bar is bound to this, so a request that never answers must still read as busy.
    const store = createPagedListStore(() => new Observable<{ content: number[]; totalElements: number }>(
      () => undefined
    ), passthrough);

    store.load();

    expect(store.loading()).toBe(true);
  });

  it('error_writtenByItsOwner_isVisibleOnTheStore', () => {
    // The page's one banner: the invoice export writes it directly, so it has to be settable from
    // outside the store and survive until a load clears it.
    const store = createPagedListStore(() => of(page(0, 10, 1)), passthrough);

    store.error.set('Export failed');

    expect(store.error()).toBe('Export failed');
  });
});
