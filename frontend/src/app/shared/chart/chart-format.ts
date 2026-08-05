import { FormatService } from '../../core/format/format.service';

/**
 * The formatters a chart option hands to ECharts, one per shape a chart actually renders.
 *
 * <p>Named by what the value MEANS rather than by the service method it calls, because that is the
 * decision a chart author gets wrong: a stock level and a stock value are both numbers on a value
 * axis, and only one of them is money. `count` and `currency` cannot be confused the way
 * `formatNumber` and `formatCurrency` at a call site can.
 */
export interface ChartFormat {
  /** Money: bar lengths, pie slices, tooltip figures on every value chart but the analytics one. */
  currency: (value: number) => string;
  /** Units - stock levels and cumulative sales. Grouped, never carrying a currency symbol. */
  count: (value: number) => string;
  /** An ISO date as it appears in raw axis data; the axis keeps the key and shows this. */
  date: (value: string) => string;
  /** A `YYYY-MM` timeline key. */
  month: (value: string) => string;
  /** A percentage out of 100, as the margin gauge's own scale states it. */
  percent: (value: number) => string;
}

/**
 * Binds the format service into callbacks an option can carry, and registers the reads that make
 * the surrounding derivation rebuild when either preference changes.
 *
 * <p>The three reads are what make a format switch REPAINT, and it is worth being exact about why,
 * because the callbacks look self-sufficient. They are closures over the service rather than over a
 * locale, so a formatter invoked after the switch already returns the new locale - but nothing
 * invokes it. ECharts calls these while it paints, and it only paints when ChartComponent hands it
 * a new option. That happens when the option's `computed` re-runs, which happens only if something
 * it read has changed. Without these reads the derivation depends on the language and the data
 * alone, the option stays the object it was, and every chart keeps the labels it last drew until a
 * refetch or a language switch happens to rebuild it.
 *
 * <p>Call it inside a chart context derivation, never inside a formatter - a read from within a
 * formatter happens outside any reactive context and is tracked by nothing.
 */
export function chartFormat(format: FormatService): ChartFormat {
  format.numberLocale();
  format.dateFormat();
  format.numberFormat();

  return {
    currency: (value: number) => format.formatCurrency(value),
    count: (value: number) => format.formatNumber(value),
    date: (value: string) => format.formatDate(value),
    month: (value: string) => format.formatMonth(value),
    percent: (value: number) => format.formatPercent(value)
  };
}
