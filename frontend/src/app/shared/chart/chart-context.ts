import { Signal, computed, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { FormatService } from '../../core/format/format.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ChartFormat, chartFormat } from './chart-format';

/** One band of a gauge axis: the fraction of the dial it ends at, and the colour up to there. */
export interface GaugeBand {
  upTo: number;
  color: string;
}

/**
 * The red-amber-green ramp a gauge paints, per theme.
 *
 * <p>Three sanctioned literals rather than tokens, and the reason is twofold. M3 defines no success
 * or warning role, so no --mat-sys-* custom property spells this ramp at all; and a gauge paints to
 * canvas, outside the DOM cascade a custom property would resolve in, so a token could not be read
 * there even if one existed. What the theme switch buys is the second row: the dark values are the
 * same ramp lightened, because the light ones read as muddy against a dark plot area.
 */
const GAUGE_BANDS: Record<string, readonly GaugeBand[]> = {
  light: [{ upTo: 0.2, color: '#d9534f' }, { upTo: 0.5, color: '#f0ad4e' }, { upTo: 1, color: '#5cb85c' }],
  dark: [{ upTo: 0.2, color: '#e57373' }, { upTo: 0.5, color: '#ffb74d' }, { upTo: 1, color: '#81c784' }]
};

/** Everything a chart option needs that is not its own data. */
export interface ChartContext {
  language: string;
  /** The label the remainder bucket carries, translated. */
  other: string;
  format: ChartFormat;
  /** The gauge ramp for the theme on screen; see {@link GAUGE_BANDS}. */
  gaugeBands: readonly GaugeBand[];
}

/**
 * Builds the derivation every chart option depends on, so an option rebuilds when the reader's
 * language or number format moves.
 *
 * @remarks
 * This exists to be a DEPENDENCY. An option that reads a translated label or a formatted number
 * directly is built once and keeps whatever it was built with: the remainder bucket kept saying
 * "Other" after a reader switched to German, because the name had been baked in at load time and
 * nothing since had invalidated the derivation.
 *
 * The `currentLang()` read is redundant today and deliberately kept. ngx-translate's `instant`
 * reads its own language signal, so the derivation already tracks language through it - but that
 * is the library's internal wiring rather than a contract it publishes, and this reads the
 * language explicitly rather than relying on it.
 *
 * The format reads inside {@link chartFormat} are the opposite: load-bearing, not belt and braces.
 * ECharts calls the formatters while it paints, outside any reactive context, so a read from
 * inside one is tracked by nothing. Registering them here is what makes a format switch repaint.
 *
 * The theme read is load-bearing for the same reason as format: gauge colours are painted to
 * canvas, so nothing repaints them unless the derivation they came from is invalidated.
 *
 * Call it from an injection context - a field initializer - because it injects the services
 * it reads rather than taking them as arguments.
 */
export function createChartContext(): Signal<ChartContext> {
  const language = inject(LanguageService);
  const translate = inject(TranslateService);
  const format = inject(FormatService);
  const theme = inject(ThemeService);

  return computed(() => ({
    language: language.currentLang(),
    other: translate.instant('charts.other') as string,
    format: chartFormat(format),
    gaugeBands: GAUGE_BANDS[theme.currentTheme()] ?? GAUGE_BANDS['light']
  }));
}
