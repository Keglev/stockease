import { Provider } from '@angular/core';

import { CHART_ENGINE, ChartEngine } from '../shared/chart/chart.component';

/**
 * Provides a fake ECharts engine so the REAL {@link ChartComponent} can render in jsdom.
 *
 * <p>This is what the `CHART_ENGINE` token exists for. The alternative - swapping the whole
 * `ChartComponent` out with `TestBed.overrideComponent` - works, but it forces Angular to
 * recompile the host component at runtime, and the recompiled template is no longer attributed
 * back to its `.html` file. That reported the dashboard and reports-page templates at 0% coverage
 * while their specs were in fact rendering and asserting on them (measured in #142, closed here).
 *
 * <p>Real echarts cannot run here: `init` reaches jsdom's canvas and dies inside zrender. Mocking
 * the module instead is racy, because spec files sharing a Vitest worker share its module
 * registry - the reason the token exists at all.
 *
 * <p>The returned instance implements only `setOption`, `resize` and `dispose`, which is the whole
 * of the contract {@link ChartComponent} depends on. It records nothing: no spec asserts on what
 * was drawn, and {@link ChartComponent} has its own spec that pins the engine calls directly.
 */
export function provideFakeChartEngine(): Provider {
  const engine = (() => ({
    setOption: () => undefined,
    resize: () => undefined,
    dispose: () => undefined
  })) as unknown as ChartEngine;

  return { provide: CHART_ENGINE, useValue: engine };
}
