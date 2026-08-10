import { Signal, computed, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { FormatService } from '../../core/format/format.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ChartFormat, chartFormat } from './chart-format';

/** Everything a chart option needs that is not its own data. */
export interface ChartContext {
  language: string;
  /** The label the remainder bucket carries, translated. */
  other: string;
  format: ChartFormat;
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
 * Call it from an injection context - a field initializer - because it injects the three services
 * it reads rather than taking them as arguments.
 */
export function createChartContext(): Signal<ChartContext> {
  const language = inject(LanguageService);
  const translate = inject(TranslateService);
  const format = inject(FormatService);

  return computed(() => ({
    language: language.currentLang(),
    other: translate.instant('charts.other') as string,
    format: chartFormat(format)
  }));
}
