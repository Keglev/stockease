import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

import {
  ChangeLogResponse,
  StockHistoryPoint,
  SupplierProduct,
  SupplierResponse
} from '../../../core/api/api-models';
import { ChartFormat } from '../../../shared/chart/chart-format';
import { ChartOption } from '../../../shared/chart/chart.component';
import { AuditService } from '../../audit/audit.service';
import { ReportService } from '../report.service';
import { ReportPeriod } from './period-toggle/period-toggle.component';
import { ReportChartContext } from './report-chart-context';
import { ReportPickerFeed } from './report-picker-feed';
import { ReportStatus } from './report-status';
import { periodRange } from './report-tab-helpers';

const PERIODS: readonly ReportPeriod[] = ['d30', 'd90', 'd180', 'year', 'all'];

/**
 * The analytics tab's state: one product's stock and price history, and the gate that decides when
 * to ask for them.
 *
 * @remarks Provided by the reports page and scoped to it (ADR 039). The only tab that fetches
 * nothing on activation, because it is the only one whose question needs a subject the reader has
 * to name first - which is why the picked product and the shown product are two signals here rather
 * than one, and why this state carries a gate no other tab needs.
 *
 * <p>Members carry no `analytics` prefix: the collaborator is the namespace.
 */
@Injectable()
export class AnalyticsTabState {
  private readonly reports = inject(ReportService);
  // Cross-feature, as the dashboard reads the reporting client: the change log belongs to the audit
  // module, and a report over it consumes that module's API rather than copying its endpoint.
  private readonly audit = inject(AuditService);
  private readonly charts = inject(ReportChartContext);
  private readonly status = inject(ReportStatus);
  private readonly pickers = inject(ReportPickerFeed);

  // Presets rather than a date picker is a deliberate scope decision; a custom range is backlog.
  readonly period = signal<ReportPeriod>('all');

  /**
   * The supplier this tab's product search is scoped to.
   *
   * <p>The supplier is a navigation aid, not a query dimension. This tab never sends it: it decides
   * which products the second field can offer, and nothing else. The analytics series are a
   * product's own history, which no supplier narrows.
   */
  readonly supplier = signal<SupplierResponse | null>(null);

  /**
   * The product the analytics tab would chart, and the one it is charting.
   *
   * <p>Two signals rather than one, because choosing is not asking. Nothing is fetched until the
   * Show button is pressed, so the tab can hold a picked product that no chart on screen reflects -
   * which is the entire point of the gate.
   */
  readonly product = signal<SupplierProduct | null>(null);
  readonly shownProductId = signal<number | null>(null);

  /** Enabled only once a product is picked; with nothing picked there is nothing to show. */
  readonly canShow = computed(() => this.product() !== null);

  readonly stockHistory = signal<StockHistoryPoint[]>([]);
  readonly priceHistory = signal<PricePoint[]>([]);

  readonly stockOption = computed(() =>
    toStockHistoryOption(
      this.stockHistory(),
      { stock: this.charts.context().stockLevel, sold: this.charts.context().soldUnits },
      this.charts.context().format
    )
  );

  readonly priceOption = computed(() =>
    toPriceHistoryOption(this.priceHistory(), this.charts.context().format)
  );

  /** Searches bound into the typeahead; an arrow property so `this` survives the input binding. */
  readonly searchProducts = (term: string): Observable<SupplierProduct[]> =>
    this.pickers.searchProductsOf(this.supplier(), term);

  /**
   * Fetches the two series for the product the user has asked to see.
   *
   * <p>Nothing is loaded when the tab opens, and no catalogue is fetched at all: the pickers query
   * as they are typed into. A tab that fetched on activation would be answering a question about a
   * product nobody had named yet.
   */
  load(): void {
    this.status.error.set(null);

    const productId = this.shownProductId();
    if (productId === null) {
      // loadTab raises the bar before dispatching, because every other tab fetches something on
      // activation. This is the one tab that can decide it has nothing to fetch, so it has to lower
      // the bar again - otherwise opening it leaves an indeterminate bar running over an idle page.
      this.status.loading.set(false);
      return;
    }
    this.status.loading.set(true);
    const range = periodRange(this.period());

    this.reports.stockHistory(productId, range.from, range.to).subscribe({
      next: (points) => {
        this.stockHistory.set(points);
        this.status.loading.set(false);
      },
      error: (err: Error) => this.status.fail(err)
    });

    // The price series comes from the audit trail rather than a reporting endpoint: a price change
    // is something a person did, and the change log is where that already lives.
    this.audit.productChanges(productId).subscribe({
      next: (rows) => {
        const points = toPricePoints(rows, range);
        this.priceHistory.set(points);
      },
      error: (err: Error) => this.status.fail(err)
    });
  }

  /**
   * Narrows which products the analytics search can offer.
   *
   * <p>The picker empties the product field with it: the one that was picked came from the previous
   * supplier's catalogue, and leaving it under a field naming a different supplier would misdescribe
   * it. That reset emits null, so the product signal clears through the ordinary path rather than a
   * second one. Whatever is already charted stays on screen - the user has not asked a new question
   * yet.
   */
  setSupplier(supplier: SupplierResponse | null): void {
    this.supplier.set(supplier);
  }

  setProduct(product: SupplierProduct | null): void {
    // Deliberately no fetch. Picking a product states what the user is interested in; the Show
    // button is where they ask for it, and until then the charts keep answering the last question.
    this.product.set(product);
  }

  /** The only path that fetches the two analytics series. */
  show(): void {
    const product = this.product();
    if (product?.id == null) {
      return;
    }
    this.shownProductId.set(product.id);
    this.load();
  }

  /** Switches the analytics window and refetches both series over the shown product. */
  setPeriod(period: ReportPeriod): void {
    // Same two guards as every other preset group on this page.
    if (!PERIODS.includes(period) || period === this.period()) {
      return;
    }
    this.period.set(period);
    // Refetches without a second press of Show, and only for a product already on screen. Asking
    // for a product is a standing request: the user wants that product's history, and a period is
    // which slice of it they want to see - not a new question about a different subject.
    if (this.shownProductId() !== null) {
      this.load();
    }
  }
}

/** One purchase price and the day it took effect. */
interface PricePoint {
  date: string;
  price: number;
}

/**
 * Turns change-log rows into the price series, keeping only what can actually be plotted.
 *
 * <p>Rows whose new value will not parse as a number are skipped rather than plotted as zero or
 * NaN. The log stores values as free text by design - that is what lets a new loggable field need
 * no schema change - so a non-numeric value here is a correctly recorded change of something that
 * is not a price, not corruption.
 *
 * <p>The window is applied here rather than by the endpoint: the per-product change listing takes
 * no period, and asking for one would widen an API two other screens already depend on.
 */
function toPricePoints(rows: ChangeLogResponse[], range: { from?: string; to?: string }): PricePoint[] {
  return rows
    .filter((row) => row.field === 'PURCHASE_PRICE')
    .filter((row) => (!range.from || row.createdAt >= range.from)
      && (!range.to || row.createdAt <= `${range.to}T23:59:59`))
    .map((row) => ({ date: row.createdAt.slice(0, 10), price: Number(row.newValue) }))
    .filter((point) => Number.isFinite(point.price))
    // The listing arrives newest first; a time axis reads the other way.
    .reverse();
}

/**
 * Plots the purchase price as a step line: a price holds until it is changed, so the sloped line an
 * ordinary series would draw between two points would show prices that were never charged.
 *
 * <p>Null below two points: one price is a fact, not a history, and a single-point line renders as
 * an empty plot area that looks broken. The template shows the no-changes state instead.
 */
function toPriceHistoryOption(points: PricePoint[], format: ChartFormat): ChartOption | null {
  if (points.length < 2) {
    return null;
  }

  return {
    tooltip: { trigger: 'axis', valueFormatter: (value) => format.currency(value as number) },
    grid: { left: 8, right: 24, top: 16, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: points.map((point) => point.date),
      axisLabel: { formatter: (value: string) => format.date(value) }
    },
    yAxis: { type: 'value', axisLabel: { formatter: (value: number) => format.currency(value) } },
    series: [{ type: 'line', step: 'end', data: points.map((point) => point.price) }]
  };
}

/**
 * Plots stock level against cumulative units sold over the days a product moved.
 *
 * <p>The stock series steps and the sales series does not, and the difference is the point: stock
 * holds its level between movements, while cumulative sales are a total that only ever grows. The
 * two together answer which products sell and which sit.
 */
function toStockHistoryOption(
  points: StockHistoryPoint[],
  labels: { stock: string; sold: string },
  format: ChartFormat
): ChartOption | null {
  if (points.length === 0) {
    return null;
  }

  return {
    // Counts, not money - the one chart on this page whose values carry no currency. Units held
    // and units sold with a euro sign on them would be a different, and wrong, report.
    tooltip: { trigger: 'axis', valueFormatter: (value) => format.count(value as number) },
    // Same inset as the other legended charts: the bottom has to clear the date labels and the
    // legend row, which a smaller value lets draw over each other.
    legend: { bottom: 0 },
    grid: { left: 8, right: 24, top: 32, bottom: 48, containLabel: true },
    xAxis: {
      type: 'category',
      data: points.map((point) => point.date),
      axisLabel: { formatter: (value: string) => format.date(value) }
    },
    yAxis: { type: 'value', axisLabel: { formatter: (value: number) => format.count(value) } },
    series: [
      { name: labels.stock, type: 'line', step: 'end', data: points.map((point) => point.stockLevel) },
      { name: labels.sold, type: 'line', data: points.map((point) => point.cumulativeSoldUnits) }
    ]
  };
}
