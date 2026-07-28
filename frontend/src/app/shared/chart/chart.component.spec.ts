import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThemeService } from '../../core/theme/theme.service';
import { ChartComponent, ChartOption } from './chart.component';

/**
 * jsdom has no canvas, so echarts' entry point is mocked and the assertions cover the wiring
 * this component owns - init, setOption and dispose - rather than rendered pixels.
 */
const echarts = vi.hoisted(() => {
  const instance = {
    setOption: vi.fn<(option: unknown, notMerge?: boolean) => void>(),
    dispose: vi.fn(),
    resize: vi.fn()
  };
  const init = vi.fn<(host: unknown, theme: unknown, opts?: unknown) => typeof instance>(
    () => instance
  );
  return { instance, init, use: vi.fn() };
});

vi.mock('echarts/core', () => ({ init: echarts.init, use: echarts.use }));

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
    echarts.init.mockClear();
    echarts.instance.setOption.mockClear();
    echarts.instance.dispose.mockClear();

    TestBed.configureTestingModule({
      providers: [{ provide: ThemeService, useClass: ThemeServiceStub }]
    });
    fixture = TestBed.createComponent(HostComponent);
    theme = TestBed.inject(ThemeService) as unknown as ThemeServiceStub;
    fixture.detectChanges();
  });

  it('ngAfterViewInit_lightTheme_initsWithDefaultThemeAndSetsOption', () => {
    expect(echarts.init).toHaveBeenCalledTimes(1);
    expect(echarts.init.mock.calls[0][1]).toBe('default');
    expect(echarts.instance.setOption).toHaveBeenCalled();
  });

  it('setOption_anyOption_keepsBackgroundTransparentAndReplacesOption', () => {
    const [applied, notMerge] = echarts.instance.setOption.mock.calls[0];

    // The Material card surface must show through instead of echarts painting its own panel.
    expect((applied as { backgroundColor: string }).backgroundColor).toBe('transparent');
    expect(notMerge).toBe(true);
  });

  it('optionChange_newOption_setsOptionWithoutReinitialising', () => {
    const before = echarts.instance.setOption.mock.calls.length;
    fixture.componentInstance.option.set({ ...OPTION, series: [{ type: 'bar', data: [2] }] });
    fixture.detectChanges();

    expect(echarts.init).toHaveBeenCalledTimes(1);
    expect(echarts.instance.setOption.mock.calls.length).toBeGreaterThan(before);
  });

  it('themeChange_toDark_disposesAndReinitsWithDarkTheme', () => {
    theme.setMode('dark');
    fixture.detectChanges();

    // The theme is bound at init, so the only way to switch it is a fresh instance.
    expect(echarts.instance.dispose).toHaveBeenCalledTimes(1);
    expect(echarts.init).toHaveBeenCalledTimes(2);
    expect(echarts.init.mock.calls[1][1]).toBe('dark');
  });

  it('destroy_afterInit_disposesInstance', () => {
    fixture.destroy();

    expect(echarts.instance.dispose).toHaveBeenCalledTimes(1);
  });
});
