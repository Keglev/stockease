/**
 * Client-side answer to chart scalability: every categorical chart plots the ten largest entries
 * and folds the rest into one aggregated bucket, so a three-hundred-product inventory still draws
 * a readable chart. A backend top-N parameter is deliberately deferred; see ADR 023.
 */

export const CHART_TOP_N = 10;

export interface ChartSlice {
  name: string;
  value: number;
}

/**
 * Ranks slices by magnitude and collapses everything past the cut into a single labelled bucket.
 * Ranking uses the absolute value because profit can be negative and a large loss is as
 * chart-worthy as a large gain; the bucket's own value is the plain sum of the remainder, so it
 * can come out negative, which is the honest figure rather than a defect.
 */
export function topNWithRemainder(
  slices: ChartSlice[],
  otherLabel: string,
  n = CHART_TOP_N
): ChartSlice[] {
  const ranked = [...slices].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  // A bucket standing for a single entry would hide a real name and aggregate nothing.
  if (ranked.length <= n) {
    return ranked;
  }

  const top = ranked.slice(0, n);
  const remainder = ranked.slice(n).reduce((sum, slice) => sum + slice.value, 0);

  return [...top, { name: otherLabel, value: remainder }];
}
