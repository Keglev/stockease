import { Injectable, computed, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { createChartContext } from '../../../shared/chart/chart-context';

/**
 * The chart rendering context every tab on the reports page derives its option from.
 *
 * @remarks Provided by the page component rather than at root, so it lives and dies with the page
 * like the tab state that reads it (ADR 039). It is a collaborator rather than a member of any one
 * tab because it belongs to none of them: five tabs read it and no tab owns it, which is the shape
 * that would otherwise pin a shared member to the page for as long as any tab remained there.
 */
@Injectable()
export class ReportChartContext {
  private readonly translate = inject(TranslateService);

  private readonly baseChartContext = createChartContext();

  /**
   * The shared chart context, widened with the vocabulary only this page's charts use.
   *
   * <p>The extra labels name series and legend entries on two tabs rather than anything a chart
   * elsewhere in the app renders, which is why they are resolved here instead of in the shared
   * derivation. Spreading the shared one in rather than reading it separately is what lets every
   * option below take its data, its labels and its formatters from a single read.
   */
  readonly context = computed(() => ({
    ...this.baseChartContext(),
    stockLevel: this.translate.instant('reports.analytics.stockLevel') as string,
    soldUnits: this.translate.instant('reports.analytics.soldUnits') as string,
    cashFlow: {
      inflow: this.translate.instant('reports.cashFlow.inflow') as string,
      outflow: this.translate.instant('reports.cashFlow.outflow') as string,
      net: this.translate.instant('reports.cashFlow.net') as string
    }
  }));
}
