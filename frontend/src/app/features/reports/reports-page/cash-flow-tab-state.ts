import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CashFlowReport,
  CashFlowTimelineBucket,
  SupplierProduct,
  SupplierResponse
} from '../../../core/api/api-models';
import { ChartFormat } from '../../../shared/chart/chart-format';
import { ChartOption } from '../../../shared/chart/chart.component';
import { CsvExportService } from '../../../shared/csv/csv-export.service';
import { ReportService } from '../report.service';
import { ReportPeriod } from './period-toggle/period-toggle.component';
import { ReportChartContext } from './report-chart-context';
import { ReportPickerFeed } from './report-picker-feed';
import { ReportStatus } from './report-status';
import { matchingNameOrSku, periodRange } from './report-tab-helpers';

const PERIODS: readonly ReportPeriod[] = ['d30', 'd90', 'd180', 'year', 'all'];

/**
 * The cash-flow tab's state: the monthly timeline, the per-product breakdown behind it, and the
 * scope controls both answer to.
 *
 * @remarks Provided by the reports page and scoped to it (ADR 039). The only tab with two loaders,
 * because the per-product half is fetched lazily - a reader who never opens the table never pays
 * for the query - which is why the loaded flag lives here rather than in the page's view plumbing:
 * the page decides that a view was switched, and this decides whether that means a fetch.
 *
 * <p>Members carry no `cashFlow` prefix: the collaborator is the namespace.
 */
@Injectable()
export class CashFlowTabState {
  private readonly reports = inject(ReportService);
  private readonly charts = inject(ReportChartContext);
  private readonly status = inject(ReportStatus);
  private readonly csv = inject(CsvExportService);
  private readonly pickers = inject(ReportPickerFeed);

  readonly columns = ['name', 'sku', 'inflow', 'outflow', 'net'];

  readonly report = signal<CashFlowReport | null>(null);
  readonly months = signal<CashFlowTimelineBucket[]>([]);

  /**
   * Free-text narrowing of the per-product table by name or SKU.
   *
   * <p>Supplier is deliberately not a filter dimension here. Attributing cash to a supplier means
   * deciding how a product bought from several of them splits, which is the same allocation question
   * the supplier-profit report documents as unsolved (ADR 024) - it belongs to the supplier
   * traceability design, not to a text box.
   */
  readonly filter = signal('');

  readonly rows = computed(() =>
    matchingNameOrSku(this.report()?.products ?? [], this.filter())
  );

  /**
   * The totals strip, summed from the monthly buckets.
   *
   * <p>Same figures the per-product report reports: both endpoints aggregate the same paid lines
   * through one shared SQL fragment and differ only in what they group by, so a month total and a
   * product total can never disagree. Reading them from the timeline is what lets the per-product
   * call stay lazy without the strip going blank on the chart view.
   */
  readonly totals = computed(() => {
    const months = this.months();
    if (months.length === 0) {
      return null;
    }
    const inflow = months.reduce((sum, month) => sum + month.inflow, 0);
    const outflow = months.reduce((sum, month) => sum + month.outflow, 0);
    return { inflow, outflow, net: inflow - outflow };
  });

  // Presets rather than a date picker is a deliberate scope decision; a custom range is backlog.
  // One signal per tab rather than one shared: the two answer different questions, and a period
  // chosen for cash flow is not a period the reader asked profit for.
  readonly period = signal<ReportPeriod>('all');

  /**
   * The supplier this tab's product search is scoped to.
   *
   * <p>The supplier is a navigation aid, not a query dimension. This tab never sends it: it decides
   * which products the second field can offer, and nothing else. Cash flow scoped by supplier would
   * be a different report from the one this tab shows.
   */
  readonly supplier = signal<SupplierResponse | null>(null);

  /** The product the cash-flow timeline is scoped to, or null for the whole business. */
  readonly product = signal<SupplierProduct | null>(null);

  readonly option = computed(() =>
    toCashFlowOption(this.months(), this.charts.context().cashFlow, this.charts.context().format)
  );

  /** Searches bound into the typeahead; an arrow property so `this` survives the input binding. */
  readonly searchProducts = (term: string): Observable<SupplierProduct[]> =>
    this.pickers.searchProductsOf(this.supplier(), term);

  // Guards the fetch rather than the rows, as the dashboard's due card does: the per-product
  // breakdown is only ever on screen in the table half, and a reader who never opens it should not
  // pay for the query.
  private productsLoaded = false;

  load(): void {
    this.status.error.set(null);
    this.status.loading.set(true);
    const range = periodRange(this.period());
    // undefined rather than null so the service leaves the parameter off entirely.
    const productId = this.product()?.id ?? undefined;

    this.reports.cashFlowTimeline(range.from, range.to, productId).subscribe({
      next: (months) => {
        this.months.set(months);
        // Translated at build time: chart options are snapshots, as everywhere else on this page.
        this.status.loading.set(false);
      },
      error: (err: Error) => this.status.fail(err)
    });

    // Only when the reader has already opened the table; otherwise the first switch fetches it.
    if (this.productsLoaded) {
      this.loadProducts();
    }
  }

  /** Called when the tab's table half is opened; the first switch is what pays for the query. */
  loadProductsIfNeeded(): void {
    if (!this.productsLoaded) {
      this.loadProducts();
    }
  }

  /** Switches the cash-flow window and refetches, since the period is a server-side filter. */
  setPeriod(period: ReportPeriod): void {
    // Two reasons to ignore an emission. The group fires once with no value at all while it is
    // being created, and these tab bodies are built eagerly, so an unguarded handler would query
    // cash flow - over a nonsense window - before the tab was ever opened. Re-picking the current
    // preset is likewise not a reason to go back to the server.
    if (!PERIODS.includes(period) || period === this.period()) {
      return;
    }
    this.period.set(period);
    this.load();
  }

  setFilter(value: string): void {
    this.filter.set(value);
  }

  /**
   * Narrows which products the cash-flow search can offer.
   *
   * <p>Clearing the product returns the timeline to the whole business, because a scoped series
   * under a field that no longer names a product would have nothing on screen explaining it. The
   * picker's reset emits null, which returns the timeline to all products if one was scoped and does
   * nothing if none was; the guard in {@link setProduct} decides which.
   */
  setSupplier(supplier: SupplierResponse | null): void {
    this.supplier.set(supplier);
  }

  /**
   * Scopes the timeline to one product, or back to the whole business when cleared.
   *
   * <p>Refetches immediately, unlike the analytics tab: there is already a series on screen, and
   * this changes what it covers rather than answering a question that had no answer before. The
   * per-product table below is untouched - it already answers the per-product question in rows, and
   * scoping it to one of them would leave a table of one.
   */
  setProduct(product: SupplierProduct | null): void {
    // Same guard as every preset toggle on this page: re-picking what is already scoped, or
    // clearing a field that scoped nothing, is no reason to go back to the server.
    if ((this.product()?.id ?? null) === (product?.id ?? null)) {
      return;
    }
    this.product.set(product);
    this.load();
  }

  export(): void {
    this.csv.export(
      'cash-flow.csv',
      this.columns,
      // The filtered rows, not all of them: the export mirrors what the user is looking at, so a
      // narrowed table and its download tell the same story.
      this.rows().map((row) => [row.name, row.sku, row.inflow, row.outflow, row.net]),
      'reports.cashFlow.columns.'
    );
  }

  private loadProducts(): void {
    this.productsLoaded = true;
    const range = periodRange(this.period());

    this.reports.cashFlow(range.from, range.to).subscribe({
      next: (report) => this.report.set(report),
      error: (err: Error) => this.status.fail(err)
    });
  }
}

/** The three translated series names the cash-flow chart labels its legend with. */
interface CashFlowLabels {
  inflow: string;
  outflow: string;
  net: string;
}

function toCashFlowOption(
  months: CashFlowTimelineBucket[],
  labels: CashFlowLabels,
  format: ChartFormat
): ChartOption | null {
  if (months.length === 0) {
    return null;
  }

  return {
    tooltip: { trigger: 'axis', valueFormatter: (value) => format.currency(value as number) },
    // Same inset as the due chart: with containLabel the bottom has to clear the axis labels AND
    // the legend row, which a smaller value lets the two draw on top of each other.
    legend: { bottom: 0 },
    grid: { left: 8, right: 24, top: 32, bottom: 48, containLabel: true },
    // The month KEYS stay the axis data: they are what the endpoint delivered, what the series are
    // indexed by and what puts the months in order. The reader sees them through the formatter.
    xAxis: {
      type: 'category',
      data: months.map((month) => month.month),
      axisLabel: { formatter: (value: string) => format.month(value) }
    },
    yAxis: { type: 'value', axisLabel: { formatter: (value: number) => format.currency(value) } },
    // Three plain lines, and deliberately NOT step-lines - the opposite of the analytics tab's two
    // series. A stock level or a price is a state that holds until something changes it, so a step
    // is the truth there. A month's cash flow is a measurement of that month alone: nothing is held
    // between two points, so a step would draw a plateau the business never sat at.
    //
    // Net is the reading the tab exists for - the two gross figures are how it got there - so it
    // carries the heavier stroke and the others stay thin enough to read behind it.
    series: [
      { name: labels.inflow, type: 'line', data: months.map((month) => month.inflow) },
      { name: labels.outflow, type: 'line', data: months.map((month) => month.outflow) },
      {
        name: labels.net,
        type: 'line',
        lineStyle: { width: 3 },
        symbolSize: 8,
        data: months.map((month) => month.net)
      }
    ]
  };
}
