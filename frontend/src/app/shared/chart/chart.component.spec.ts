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
