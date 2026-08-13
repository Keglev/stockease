import { Sort } from '@angular/material/sort';

import { ReportPeriod } from './period-toggle/period-toggle.component';

/**
 * The period, sort and filter primitives every report tab's state is built from.
 *
 * @remarks Extracted so that a tab state collaborator never imports the page that provides it
 * (ADR 039). The page needs the same three for the tabs it still holds, so leaving them on the
 * component would have made the collaborators depend on their own host - a cycle, and a dependency
 * pointing the wrong way. They are primitives rather than a service because none of them reads
 * state: each answers only from its arguments.
 */
const PERIOD_DAYS: Record<'d30' | 'd90' | 'd180', number> = { d30: 30, d90: 90, d180: 180 };

/** Local calendar date in the YYYY-MM-DD shape the API takes; UTC would shift the boundary. */
function isoDate(value: Date): string {
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

/**
 * Turns a preset into the ISO bounds the endpoints take, or no bounds at all for the open window.
 * Computed from the browser's date because the presets describe the operator's calendar, and both
 * backends compare against a date rather than a timestamp. Shared by the profit and cash-flow
 * tabs: two copies of this arithmetic would be two chances to drift apart.
 */
export function periodRange(period: ReportPeriod): { from?: string; to?: string } {
  if (period === 'all') {
    return {};
  }
  const today = new Date();
  if (period === 'year') {
    return { from: isoDate(new Date(today.getFullYear(), 0, 1)), to: isoDate(today) };
  }
  const start = new Date(today);
  start.setDate(start.getDate() - PERIOD_DAYS[period]);
  return { from: isoDate(start), to: isoDate(today) };
}

/**
 * Narrows report rows to those whose name or SKU contains `needle`, ignoring case.
 *
 * <p>One predicate for all three filtered tables. They ask the reader the same question, so three
 * copies would only be three chances for them to start answering it differently.
 */
export function matchingNameOrSku<T extends { name: string; sku: string }>(
  rows: T[],
  needle: string
): T[] {
  const term = needle.trim().toLowerCase();
  if (!term) {
    return rows;
  }
  return rows.filter(
    (row) => row.name.toLowerCase().includes(term) || row.sku.toLowerCase().includes(term)
  );
}

/** Sorts in the component rather than through MatTableDataSource, whose MatSort wiring would
 * race the lazily rendered tabs. */
export function sortRows<T>(rows: T[], sort: Sort): T[] {
  if (!sort.active || sort.direction === '') {
    return rows;
  }
  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...rows].sort((left, right) => {
    const a = (left as Record<string, unknown>)[sort.active];
    const b = (right as Record<string, unknown>)[sort.active];
    if (typeof a === 'number' && typeof b === 'number') {
      return (a - b) * factor;
    }
    return String(a).localeCompare(String(b)) * factor;
  });
}
