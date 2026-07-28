import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { BarChart, type BarSeriesOption } from 'echarts/charts';
import {
  GridComponent,
  type GridComponentOption,
  LegendComponent,
  type LegendComponentOption,
  TooltipComponent,
  type TooltipComponentOption
} from 'echarts/components';
import { type ComposeOption, type ECharts, init, use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

import { ThemeService } from '../../core/theme/theme.service';

// ECharts is used directly rather than through ngx-echarts or any other Angular wrapper: it is
// framework-agnostic and declares no Angular or TypeScript peer dependency, so it cannot be the
// package that blocks an Angular upgrade. The cost of that choice is this file, and this file is
// the whole of it.
//
// Registration happens here once, for the entire app: the modular echarts/core entry point ships
// nothing by default, so only the pieces listed below reach the bundle. Importing the 'echarts'
// barrel instead would pull every chart type and component in. Anything a future chart needs must
// be added to this list.
use([CanvasRenderer, BarChart, GridComponent, TooltipComponent, LegendComponent]);

/**
 * The option type accepted by this wrapper. It is echarts' EChartsOption narrowed to the modules
 * registered above, so an option using an unregistered chart type fails to compile rather than
 * rendering blank.
 */
export type ChartOption = ComposeOption<
  BarSeriesOption | GridComponentOption | TooltipComponentOption | LegendComponentOption
>;

const DARK_THEME = 'dark';

const DEFAULT_THEME = 'default';

/**
 * Thin ECharts wrapper owning the whole instance lifecycle: init, option updates, resize and
 * dispose. It is the single point through which the app draws charts, so no feature component
 * ever touches the echarts API directly.
 */
@Component({
  selector: 'app-chart',
  template: '<div #chartHost class="chart-host" [style.height]="height()"></div>',
  styles: '.chart-host { width: 100%; }'
})
export class ChartComponent implements AfterViewInit, OnDestroy {
  private readonly theme = inject(ThemeService);

  readonly option = input.required<ChartOption>();

  readonly height = input('20rem');

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('chartHost');

  private readonly viewReady = signal(false);

  private chart: ECharts | null = null;

  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    // A theme change cannot be applied to a live instance: echarts binds the theme at init, so
    // the instance is torn down and rebuilt. The option is read untracked so an option change
    // does not trigger this more expensive path.
    effect(() => {
      const mode = this.theme.currentTheme();
      if (this.viewReady()) {
        untracked(() => this.create(mode));
      }
    });

    effect(() => {
      this.option();
      if (this.viewReady()) {
        untracked(() => this.applyOption());
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
    this.observeResize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.destroyChart();
  }

  private create(mode: string): void {
    this.destroyChart();
    // backgroundColor stays transparent so the Material card surface shows through and the chart
    // does not paint its own panel over the app's theme.
    this.chart = init(this.host().nativeElement, mode === DARK_THEME ? DARK_THEME : DEFAULT_THEME, {
      renderer: 'canvas'
    });
    this.applyOption();
  }

  /** notMerge is on so a shorter series list replaces the previous one instead of leaving remnants. */
  private applyOption(): void {
    this.chart?.setOption({ backgroundColor: 'transparent', ...this.option() }, true);
  }

  private destroyChart(): void {
    this.chart?.dispose();
    this.chart = null;
  }

  /** Charts sit in a responsive grid, so the instance follows its host box rather than the window. */
  private observeResize(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
    this.resizeObserver.observe(this.host().nativeElement);
  }
}
