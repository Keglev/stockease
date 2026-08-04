import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThemeService } from '../../core/theme/theme.service';
import { CHART_ENGINE, ChartComponent, ChartOption } from './chart.component';

/**
 * jsdom has no canvas, so the engine is stubbed through CHART_ENGINE and the assertions cover
 * the wiring this component owns - init, setOption and dispose - rather than rendered pixels.
 */
const instance = {
  setOption: vi.fn<(option: unknown, notMerge?: boolean) => void>(),
  dispose: vi.fn(),
  resize: vi.fn()
};

const engine = vi.fn<(host: unknown, theme: unknown, opts?: unknown) => typeof instance>(
  () => instance
);

const OPTION: ChartOption = {
  xAxis: { type: 'category', data: ['a'] },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: [1] }]
};

class ThemeServiceStub {
  private readonly mode = signal<'light' | 'dark'>('light');
  readonly currentTheme = this.mode.asReadonly();

  setMode(next: 'light' | 'dark'): void {
    this.mode.set(next);
  }
}

@Component({
  imports: [ChartComponent],
  template: '<app-chart [option]="option()" height="10rem" />'
})
class HostComponent {
  readonly option = signal<ChartOption>(OPTION);
}

describe('ChartComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let theme: ThemeServiceStub;

  beforeEach(() => {
    // Reset first: tearing down the previous fixture disposes its chart and would otherwise
    // land on the freshly cleared counters.
    TestBed.resetTestingModule();
    engine.mockClear();
    instance.setOption.mockClear();
    instance.dispose.mockClear();

    TestBed.configureTestingModule({
      providers: [
        { provide: ThemeService, useClass: ThemeServiceStub },
        { provide: CHART_ENGINE, useValue: engine }
      ]
    });
    fixture = TestBed.createComponent(HostComponent);
    theme = TestBed.inject(ThemeService) as unknown as ThemeServiceStub;
    fixture.detectChanges();
  });

  it('ngAfterViewInit_lightTheme_initsWithDefaultThemeAndSetsOption', () => {
    expect(engine).toHaveBeenCalledTimes(1);
    expect(engine.mock.calls[0][1]).toBe('default');
    expect(instance.setOption).toHaveBeenCalled();
  });

  it('setOption_anyOption_keepsBackgroundTransparentAndReplacesOption', () => {
    const [applied, notMerge] = instance.setOption.mock.calls[0];

    // The Material card surface must show through instead of echarts painting its own panel.
    expect((applied as { backgroundColor: string }).backgroundColor).toBe('transparent');
    expect(notMerge).toBe(true);
  });

  it('optionChange_newOption_setsOptionWithoutReinitialising', () => {
    const before = instance.setOption.mock.calls.length;
    fixture.componentInstance.option.set({ ...OPTION, series: [{ type: 'bar', data: [2] }] });
    fixture.detectChanges();

    expect(engine).toHaveBeenCalledTimes(1);
    expect(instance.setOption.mock.calls.length).toBeGreaterThan(before);
  });

  it('themeChange_toDark_disposesAndReinitsWithDarkTheme', () => {
    theme.setMode('dark');
    fixture.detectChanges();

    // The theme is bound at init, so the only way to switch it is a fresh instance.
    expect(instance.dispose).toHaveBeenCalledTimes(1);
    expect(engine).toHaveBeenCalledTimes(2);
    expect(engine.mock.calls[1][1]).toBe('dark');
  });

  it('destroy_afterInit_disposesInstance', () => {
    fixture.destroy();

    expect(instance.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('ChartComponent resize handling', () => {
  /** The callback the component handed to ResizeObserver, so a resize can be simulated. */
  let observed: (() => void) | null;
  let disconnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    observed = null;
    disconnect = vi.fn();
    // jsdom ships no ResizeObserver, so the component's own guard skips the wiring entirely and
    // the callback below is never created. Supplying one is what makes this path reachable.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          observed = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      }
    );

    TestBed.resetTestingModule();
    engine.mockClear();
    instance.resize.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: ThemeService, useClass: ThemeServiceStub },
        { provide: CHART_ENGINE, useValue: engine }
      ]
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hostResized_afterInit_resizesTheChartInstance', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    observed?.();

    // Charts sit in a responsive grid, so the instance follows its host box. Without this the
    // chart would keep the width it was born with and clip inside a resized card.
    expect(instance.resize).toHaveBeenCalledTimes(1);
  });

  it('destroy_afterObserving_disconnectsTheObserver', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    fixture.destroy();

    // A live observer holding the host element keeps the destroyed component reachable.
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('CHART_ENGINE token', () => {
  it('inject_withoutAnOverride_resolvesToEchartsInit', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});

    // Every other spec overrides this token, so nothing otherwise executes the default factory -
    // and a broken default is exactly the failure that would reach production unnoticed. The
    // function is resolved, never called: calling it would drive real echarts into jsdom.
    expect(TestBed.inject(CHART_ENGINE)).toBeTypeOf('function');
  });
});
