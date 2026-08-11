import { Injectable, inject } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslateService } from '@ngx-translate/core';

/**
 * Supplies every `mat-paginator` on the four list pages with translated labels.
 *
 * @remarks
 * Material ships these strings hardcoded in English and outside any translation pipeline: the
 * labels are plain properties on {@link MatPaginatorIntl} and the range is a function the component
 * calls while it renders, so no `translate` pipe can reach them. Registering a subclass as the
 * `MatPaginatorIntl` provider is the only seam Material offers, which is why this class exists
 * rather than markup somewhere.
 *
 * The range label is the reason a plain object of strings would not do. It reports which slice of
 * how many is on screen, so it takes parameters, and word order around them differs by language -
 * which is exactly what an interpolated message resolves and a concatenation cannot.
 *
 * Labels are re-resolved on every language change and `changes` is emitted with them. A paginator
 * reads these properties once per render, so without that emission a switch would leave every
 * paginator already on screen showing the previous language until something else redrew it.
 */
@Injectable()
export class LocalizedPaginatorIntl extends MatPaginatorIntl {
  private readonly translate = inject(TranslateService);

  constructor() {
    super();
    this.resolveLabels();
    // Every already-rendered paginator repaints from this; see the class remarks.
    this.translate.onLangChange.subscribe(() => {
      this.resolveLabels();
      this.changes.next();
    });
  }

  /**
   * Reports the slice on screen, as `1 - 10 of 42`.
   *
   * <p>An empty list takes its own message rather than the range with zeroes in it: "0 - 0 of 0"
   * describes a slice that was never asked for, where "0 of 0" states the count, which is the only
   * fact there is.
   */
  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    const total = Math.max(length, 0);
    if (total === 0 || pageSize === 0) {
      return this.translate.instant('common.paginator.rangeEmpty', { total }) as string;
    }
    const start = page * pageSize;
    // Capped at the total, because the last page is usually short of a full one.
    const end = Math.min(start + pageSize, total);
    return this.translate.instant('common.paginator.range', { start: start + 1, end, total }) as string;
  };

  private resolveLabels(): void {
    this.itemsPerPageLabel = this.translate.instant('common.paginator.itemsPerPage') as string;
    this.firstPageLabel = this.translate.instant('common.paginator.firstPage') as string;
    this.previousPageLabel = this.translate.instant('common.paginator.previousPage') as string;
    this.nextPageLabel = this.translate.instant('common.paginator.nextPage') as string;
    this.lastPageLabel = this.translate.instant('common.paginator.lastPage') as string;
  }
}
