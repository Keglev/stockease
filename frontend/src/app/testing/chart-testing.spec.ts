import { TestBed } from '@angular/core/testing';

import { CHART_ENGINE } from '../shared/chart/chart.component';
import { provideFakeChartEngine } from './chart-testing';

/*
 * Pins the fake engine against the contract {@link ChartComponent} actually calls.
 *
 * <p>Today's consumers reach only `setOption`: jsdom ships no ResizeObserver, so the component
 * skips the wiring that would call `resize`, and `dispose` runs on teardown. That is exactly why
 * this spec exists - a fake trimmed to what today's specs happen to touch would break the first
 * chart spec that supplies an observer, and it would break inside Angular rather than here.
 */
describe('provideFakeChartEngine', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideFakeChartEngine()] });
  });

  it('resolve_token_returnsAnInitFunction', () => {
    expect(TestBed.inject(CHART_ENGINE)).toBeTypeOf('function');
  });

  it('init_returnedInstance_answersEveryCallTheChartComponentMakes', () => {
    const instance = TestBed.inject(CHART_ENGINE)(document.createElement('div'));

    // Called rather than merely present: a property that is not a function passes a typeof check
    // on the object and still throws the moment the component uses it.
    expect(() => instance.setOption({})).not.toThrow();
    expect(() => instance.resize()).not.toThrow();
    expect(() => instance.dispose()).not.toThrow();
  });
});
