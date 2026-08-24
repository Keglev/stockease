import { Observable, of, throwError } from 'rxjs';

import { createListPageStore } from './list-page-store';

/*
 * The store takes a resolveMessage seam rather than rendering err.message itself, so these specs
 * hand it the identity of that seam: every case below is about paging and load state, and a
 * passthrough keeps their assertions about the message exactly what they were.
 */
const passthrough = (err: Error): string => err.message;

/* Builds a numbered row set of the given size, so page boundaries are readable in the assertions. */
function rows(count: number): number[] {
  return Array.from({ length: count }, (unused, index) => index);
}

/*
 * The state a register page keeps while it holds its whole list in memory: what a load leaves
 * behind on success and on failure, which slice the table renders, and where the page index lands
 * when rows disappear underneath it.
 * Out of scope: the pages that own a store - customer-list and supplier-list specs.
 */
describe('createListPageStore', () => {
  it('load_success_populatesRowsAndClearsLoadingAndError', () => {
    const store = createListPageStore(() => of(rows(3)), passthrough);

    store.load();

    expect(store.rows()).toEqual([0, 1, 2]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('load_failure_reportsMessageAndEmptiesRows', () => {
    // The rows are dropped rather than left on screen: stale rows beside an error message read as
    // though they were the answer to the failed request.
    const store = createListPageStore(() => throwError(() => new Error('Backend unreachable')), passthrough);

    store.load();

    expect(store.rows()).toEqual([]);
    expect(store.error()).toBe('Backend unreachable');
    expect(store.loading()).toBe(false);
  });

  it('load_failure_reportsWhatResolveMessageReturnsRatherThanTheRawMessage', () => {
    // The seam is the point: the store must render what its caller's resolver returns, not the
    // error's own text. Marker strings rather than real sentences, because the claim is about
    // which of the two the store reaches for and not about any wording.
    const store = createListPageStore(
      () => throwError(() => new Error('RAW-MESSAGE')),
      () => 'RESOLVED-MESSAGE'
    );

    store.load();

    expect(store.error()).toBe('RESOLVED-MESSAGE');
    expect(store.error()).not.toBe('RAW-MESSAGE');
  });

  it('load_fewerRowsThanTheCurrentPage_clampsPageIndexToTheLastPage', () => {
    // Deleting the last row of the last page would otherwise strand the table on a page that is
    // no longer there, showing nothing.
    let available = rows(12);
    const store = createListPageStore(() => of(available), passthrough);
    store.load();
    store.onPage({ pageIndex: 1, pageSize: 10, length: 12 });

    available = rows(10);
    store.load();

    expect(store.pageIndex()).toBe(0);
  });

  it('visibleRows_secondPage_returnsThatSliceOnly', () => {
    const store = createListPageStore(() => of(rows(12)), passthrough);
    store.load();

    store.onPage({ pageIndex: 1, pageSize: 10, length: 12 });

    expect(store.visibleRows()).toEqual([10, 11]);
  });

  it('load_calledAgainAfterAMutation_refetchesRatherThanReusingTheRows', () => {
    let available = rows(2);
    const store = createListPageStore(() => of(available), passthrough);
    store.load();

    available = rows(3);
    store.load();

    expect(store.rows()).toEqual([0, 1, 2]);
  });

  it('load_pendingRequest_reportsLoadingUntilItAnswers', () => {
    // The progress bar is bound to this, so a request that never answers must still read as busy.
    const store = createListPageStore(() => new Observable<number[]>(() => undefined), passthrough);

    store.load();

    expect(store.loading()).toBe(true);
  });
});
