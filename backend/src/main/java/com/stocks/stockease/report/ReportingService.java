package com.stocks.stockease.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.shared.SearchLimits;

import lombok.RequiredArgsConstructor;

/**
 * Read model over the schema, answering aggregation questions with native SQL rather than through the
 * domain model. Reports are derived at read time and never stored.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportingService {

    /** Shown instead of a counterparty name for sale invoices that name no customer. */
    private static final String CASH_SALE = "Cash sale";

    // Historical report: soft-deleted products are INCLUDED (movements reference them regardless); the
    // deleted flag lets callers mark them.
    //
    // Cost is cost of goods SOLD, not cash spent on stock: only the units that left count, priced at
    // the cost their own sale captured, and a customer return reverses revenue and cost together at
    // the same prices. Purchases and supplier returns are absent by design - they move cash, not
    // profit, and belong to the cash-flow report (ADR 024). That also retired the invoice_item join,
    // which existed solely to price supplier returns.
    private static final String PRODUCT_PROFIT_EXPRESSIONS = """
            SELECT p.id, p.name, p.sku, (p.deleted_at IS NOT NULL) AS deleted,
              COALESCE(SUM(CASE WHEN m.reason = 'SOLD' THEN m.quantity * m.sold_price
                                WHEN m.reason = 'RETURN_FROM_CUSTOMER' THEN -m.quantity * m.sold_price
                                ELSE 0 END), 0) AS revenue,
              COALESCE(SUM(CASE WHEN m.reason = 'SOLD' THEN m.quantity * m.unit_cost
                                WHEN m.reason = 'RETURN_FROM_CUSTOMER' THEN -m.quantity * m.unit_cost
                                ELSE 0 END), 0) AS cost
            FROM product p
            """;

    // The period predicate belongs to the JOIN, not to WHERE: in the WHERE clause it would discard
    // the NULL-extended rows the LEFT JOIN produces, so a product with no movements in the window
    // would vanish from the report instead of appearing with zeros. Casting the parameters lets one
    // statement serve the filtered and unfiltered calls. The window is a closed range of dates, so
    // the upper bound covers the whole of `to`.
    private static final String PRODUCT_PROFIT_JOIN = """
            LEFT JOIN stock_movement m ON m.product_id = p.id
              AND (CAST(:from AS date) IS NULL OR m.created_at >= CAST(:from AS date))
              AND (CAST(:to AS date) IS NULL OR m.created_at < CAST(:to AS date) + INTERVAL '1 day')
            """;

    private static final String PRODUCT_PROFIT_SELECT = PRODUCT_PROFIT_EXPRESSIONS + PRODUCT_PROFIT_JOIN;

    private static final String PRODUCT_PROFIT_GROUP = """
            GROUP BY p.id, p.name, p.sku, p.deleted_at
            ORDER BY p.id
            """;

    // The two cash-flow reports answer the same question at different groupings, so the definition of
    // the question lives here once. Sharing the fragments is what keeps a timeline month and the
    // product rows underneath it from ever summing to different figures - the same reason the profit
    // queries share PRODUCT_PROFIT_JOIN rather than repeating its predicate.

    /** Money received, netting each line's returned quantity out of its value at the line's own price. */
    private static final String CASH_FLOW_INFLOW = """
            COALESCE(SUM(CASE WHEN i.invoice_type = 'SALE'
                              THEN (ii.quantity - ii.returned_qty) * ii.unit_price
                              ELSE 0 END), 0)""";

    /** Money spent, on the same net-of-returns basis as the inflow above. */
    private static final String CASH_FLOW_OUTFLOW = """
            COALESCE(SUM(CASE WHEN i.invoice_type = 'PURCHASE'
                              THEN (ii.quantity - ii.returned_qty) * ii.unit_price
                              ELSE 0 END), 0)""";

    /**
     * The paid lines a cash-flow query reads, through the payment-date window it reads them in.
     *
     * <p>Plain WHERE rather than a JOIN predicate, unlike the profit queries: unpaid invoices are
     * excluded by the report's own definition, so there is no zero row to preserve. Anything that
     * moved no money in the window is simply absent - a cash-flow report lists money that moved, and
     * padding it with zeros would invite reading "nothing happened" as "nothing exists".
     */
    private static final String CASH_FLOW_SOURCE = """
            FROM invoice_item ii
            JOIN invoice i ON i.id = ii.invoice_id
            JOIN product p ON p.id = ii.product_id
            WHERE i.paid_at IS NOT NULL AND i.deleted_at IS NULL
              AND (CAST(:from AS date) IS NULL OR i.paid_at >= CAST(:from AS date))
              AND (CAST(:to AS date) IS NULL OR i.paid_at < CAST(:to AS date) + INTERVAL '1 day')
            """;

    /**
     * The one predicate that scopes a cash-flow query to a single product.
     *
     * <p>A fragment rather than a second copy of each query for the same reason the inflow and
     * outflow expressions are shared: the timeline and the per-product rows must never disagree
     * about what a product's cash flow is, and a forked query is how they would start to. Null
     * {@code productId} leaves every line in, so the unscoped call is the same query it always was.
     */
    private static final String CASH_FLOW_PRODUCT_FILTER = """
              AND (CAST(:productId AS bigint) IS NULL OR ii.product_id = :productId)
            """;

    /**
     * The products one supplier has actually sold this business, matched by name.
     *
     * <p>The linkage runs through the purchase ledger rather than through master data, because there
     * is no supplier column on a product: a product belongs to whoever was invoiced for it. Stock
     * enters only through closed purchase invoices (ADR 021), so every stocked product is reachable
     * this way - and a product bought from two suppliers is reachable under both, which is correct
     * rather than a duplicate to be resolved. DISTINCT collapses the repeat purchases of one product
     * from one supplier, which is what makes this a picker rather than a purchase history.
     *
     * <p>Soft-deleted products are excluded, matching the product API's own search: this list exists
     * to be picked from, and a retired product is not something to start a new enquiry about. The
     * history endpoints still answer for one reached by identifier.
     */
    private static final String SUPPLIER_PRODUCT_SEARCH = """
            SELECT DISTINCT p.id, p.name, p.sku, p.quantity, p.purchase_price, p.created_at
            FROM invoice_item ii
            JOIN invoice i ON i.id = ii.invoice_id
            JOIN product p ON p.id = ii.product_id
            WHERE i.supplier_id = :supplierId
              AND i.invoice_type = 'PURCHASE'
              AND i.deleted_at IS NULL
              AND p.deleted_at IS NULL
              AND p.name ILIKE '%' || :name || '%'
            ORDER BY p.name
            LIMIT :limit
            """;

    /** Outstanding value per invoice, netting out quantities already returned. */
    private static final String OUTSTANDING_SUBQUERY = """
            JOIN (SELECT ii.invoice_id, SUM((ii.quantity - ii.returned_qty) * ii.unit_price) AS outstanding
                  FROM invoice_item ii GROUP BY ii.invoice_id) t ON t.invoice_id = i.id
            """;

    private final JdbcClient jdbcClient;

    private static final RowMapper<ProductProfitReport> PRODUCT_PROFIT_MAPPER = (rs, rowNum) -> {
        BigDecimal revenue = rs.getBigDecimal("revenue");
        BigDecimal cost = rs.getBigDecimal("cost");
        return new ProductProfitReport(rs.getLong("id"), rs.getString("name"), rs.getString("sku"),
                rs.getBoolean("deleted"), revenue, cost, revenue.subtract(cost));
    };

    private static final RowMapper<InvoiceDueSummary> DUE_SOON_MAPPER = (rs, rowNum) -> new InvoiceDueSummary(
            rs.getLong("id"), rs.getString("invoice_number"), rs.getString("invoice_type"),
            counterparty(rs.getString("counterparty")), rs.getObject("due_date", LocalDate.class),
            rs.getBigDecimal("outstanding"), null);

    private static final RowMapper<InvoiceDueSummary> OVERDUE_MAPPER = (rs, rowNum) -> new InvoiceDueSummary(
            rs.getLong("id"), rs.getString("invoice_number"), rs.getString("invoice_type"),
            counterparty(rs.getString("counterparty")), rs.getObject("due_date", LocalDate.class),
            rs.getBigDecimal("outstanding"), rs.getLong("days_overdue"));

    private static final RowMapper<CustomerSummary> CUSTOMER_SUMMARY_MAPPER = (rs, rowNum) -> new CustomerSummary(
            rs.getLong("id"), rs.getString("name"), rs.getBoolean("deleted"), rs.getLong("sale_invoice_count"),
            rs.getLong("bought_units"), rs.getBigDecimal("bought_value"), rs.getLong("returned_units"),
            rs.getBigDecimal("returned_value"));

    private static final RowMapper<CashFlowProductRow> CASH_FLOW_MAPPER = (rs, rowNum) -> {
        BigDecimal inflow = rs.getBigDecimal("inflow");
        BigDecimal outflow = rs.getBigDecimal("outflow");
        return new CashFlowProductRow(rs.getLong("id"), rs.getString("name"), rs.getString("sku"),
                rs.getBoolean("deleted"), inflow, outflow, inflow.subtract(outflow));
    };

    private static final RowMapper<SupplierProduct> SUPPLIER_PRODUCT_MAPPER = (rs, rowNum) -> {
        BigDecimal price = rs.getBigDecimal("purchase_price");
        int quantity = rs.getInt("quantity");
        // Derived here rather than selected, matching how the product API mints the same field.
        return new SupplierProduct(rs.getLong("id"), rs.getString("name"), rs.getString("sku"), quantity, price,
                price == null ? null : price.multiply(BigDecimal.valueOf(quantity)),
                rs.getObject("created_at", LocalDateTime.class));
    };

    private static final RowMapper<CashFlowTimelineBucket> CASH_FLOW_TIMELINE_MAPPER = (rs, rowNum) -> {
        BigDecimal inflow = rs.getBigDecimal("inflow");
        BigDecimal outflow = rs.getBigDecimal("outflow");
        return new CashFlowTimelineBucket(rs.getString("month"), inflow, outflow, inflow.subtract(outflow));
    };

    /** An invoice naming neither supplier nor customer is an anonymous cash sale. */
    private static String counterparty(String name) {
        return name == null ? CASH_SALE : name;
    }

    /**
     * Returns gross profit for every product, including soft-deleted ones, over an optional period.
     *
     * <p>The period is a closed range of movement dates: a movement counts when it was recorded on
     * or between the two dates. Either bound may be null, which leaves that end open. Products
     * without movements in the window still appear, with zeros.
     *
     * @param from first booking date to count, or {@code null} for no lower bound
     * @param to last booking date to count, or {@code null} for no upper bound
     * @return one row per product, ordered by product ID
     */
    public List<ProductProfitReport> profitPerProduct(LocalDate from, LocalDate to) {
        return jdbcClient.sql(PRODUCT_PROFIT_SELECT + PRODUCT_PROFIT_GROUP)
                .param("from", from)
                .param("to", to)
                .query(PRODUCT_PROFIT_MAPPER)
                .list();
    }

    /**
     * Returns gross profit for one product over an optional booking period.
     *
     * @param productId product identifier
     * @param from first booking date to count, or {@code null} for no lower bound
     * @param to last booking date to count, or {@code null} for no upper bound
     * @return the product's profit row, or empty if no such product exists
     */
    public Optional<ProductProfitReport> profitForProduct(long productId, LocalDate from, LocalDate to) {
        return jdbcClient.sql(PRODUCT_PROFIT_SELECT + "WHERE p.id = :id\n" + PRODUCT_PROFIT_GROUP)
                .param("id", productId)
                .param("from", from)
                .param("to", to)
                .query(PRODUCT_PROFIT_MAPPER)
                .optional();
    }

    /**
     * Returns gross profit attributed to each supplier across the products it has supplied, over an
     * optional period.
     *
     * <p>The period is a closed range of movement dates, exactly as the product reports read it: a
     * movement counts when it was recorded on or between the two dates. Either bound may be null,
     * which leaves that end open. Suppliers without movements in the window still appear, with zeros.
     *
     * @param from first booking date to count, or {@code null} for no lower bound
     * @param to last booking date to count, or {@code null} for no upper bound
     * @return one row per supplier that has supplied at least one product, ordered by supplier ID
     */
    public List<SupplierProfitReport> profitPerSupplier(LocalDate from, LocalDate to) {
        // A product purchased from several suppliers counts fully for each of them - documented
        // simplification (gross profit model, no per-supplier cost allocation).
        // The per-product expressions repeat those of the product report on purpose: the two are one
        // definition of gross profit and the reports page shows them side by side, so they move
        // together (ADR 024). Only the shape around them differs - this one groups by supplier.
        // The period join is the product report's own constant rather than a copy of it, so the two
        // cannot answer the same period differently.
        String sql = """
                WITH product_profit AS (
                  SELECT p.id,
                    COALESCE(SUM(CASE WHEN m.reason = 'SOLD' THEN m.quantity * m.sold_price
                                      WHEN m.reason = 'RETURN_FROM_CUSTOMER' THEN -m.quantity * m.sold_price
                                      ELSE 0 END), 0) AS revenue,
                    COALESCE(SUM(CASE WHEN m.reason = 'SOLD' THEN m.quantity * m.unit_cost
                                      WHEN m.reason = 'RETURN_FROM_CUSTOMER' THEN -m.quantity * m.unit_cost
                                      ELSE 0 END), 0) AS cost
                  FROM product p
                """ + PRODUCT_PROFIT_JOIN + """
                  GROUP BY p.id
                ), supplier_products AS (
                  SELECT DISTINCT i.supplier_id, ii.product_id
                  FROM invoice i JOIN invoice_item ii ON ii.invoice_id = i.id
                  WHERE i.invoice_type = 'PURCHASE'
                )
                SELECT s.id, s.name, COALESCE(SUM(pp.revenue),0) AS revenue, COALESCE(SUM(pp.cost),0) AS cost
                FROM supplier s
                JOIN supplier_products sp ON sp.supplier_id = s.id
                JOIN product_profit pp ON pp.id = sp.product_id
                GROUP BY s.id, s.name
                ORDER BY s.id
                """;
        return jdbcClient.sql(sql)
                .param("from", from)
                .param("to", to)
                .query((rs, rowNum) -> {
                    BigDecimal revenue = rs.getBigDecimal("revenue");
                    BigDecimal cost = rs.getBigDecimal("cost");
                    return new SupplierProfitReport(rs.getLong("id"), rs.getString("name"), revenue, cost,
                            revenue.subtract(cost));
                }).list();
    }

    /**
     * Returns one product's stock level and cumulative sales over the days that moved it.
     *
     * <p>Derivable at all only because the ledger is complete: stock enters and leaves exclusively
     * through booked movements (ADR 021), and V18 removed the pre-ledger rows that once made the
     * running sum disagree with the product's own quantity. The final point therefore equals that
     * quantity, which is the invariant the tests pin.
     *
     * <p>A soft-deleted product still answers - what it did is history, and retiring it does not
     * unmake it.
     *
     * @param productId product identifier
     * @param from first day to return, or {@code null} for no lower bound
     * @param to last day to return, or {@code null} for no upper bound
     * @return the product's history within the window, oldest first, or empty if no such product
     *         exists; a product that never moved answers an empty list rather than an empty optional
     */
    public Optional<List<StockHistoryPoint>> stockHistory(long productId, LocalDate from, LocalDate to) {
        // Native, so a soft-deleted product is still found: @SQLRestriction hides those from every
        // mapped query, and this report exists to show what happened rather than what is current.
        Integer found = jdbcClient.sql("SELECT 1 FROM product WHERE id = :id")
                .param("id", productId)
                .query(Integer.class)
                .optional()
                .orElse(null);
        if (found == null) {
            return Optional.empty();
        }

        // The window is applied AFTER the running sums, and that ordering is the whole correctness
        // of this query. Filtering the movements first would restart the count inside the window, so
        // a product bought a year ago and asked about over the last 30 days would appear to have
        // begun at zero. The sums run over every movement the product ever had; the outer WHERE only
        // decides which of the resulting points are returned.
        //
        // The sign comes from the movement's own persisted type rather than from a list of reasons
        // restated here. That column is written from MovementReason.getType(), which is the same
        // authority StockMovementService.recordMovement reads to compute its delta - so the two can
        // never disagree about which way a reason moves stock.
        String sql = """
                WITH daily AS (
                  SELECT CAST(m.created_at AS date) AS day,
                    SUM(CASE WHEN m.type = 'INCREASE' THEN m.quantity ELSE -m.quantity END) AS net_change,
                    SUM(CASE WHEN m.reason = 'SOLD' THEN m.quantity
                             WHEN m.reason = 'RETURN_FROM_CUSTOMER' THEN -m.quantity
                             ELSE 0 END) AS net_sold
                  FROM stock_movement m
                  WHERE m.product_id = :id
                  GROUP BY CAST(m.created_at AS date)
                ), running AS (
                  SELECT day,
                    SUM(net_change) OVER (ORDER BY day) AS stock_level,
                    SUM(net_sold) OVER (ORDER BY day) AS sold_units
                  FROM daily
                )
                SELECT day, stock_level, sold_units
                FROM running
                WHERE (CAST(:from AS date) IS NULL OR day >= CAST(:from AS date))
                  AND (CAST(:to AS date) IS NULL OR day <= CAST(:to AS date))
                ORDER BY day
                """;
        return Optional.of(jdbcClient.sql(sql)
                .param("id", productId)
                .param("from", from)
                .param("to", to)
                .query((rs, rowNum) -> new StockHistoryPoint(rs.getObject("day", LocalDate.class),
                        rs.getInt("stock_level"), rs.getInt("sold_units")))
                .list());
    }

    /**
     * Returns what each live product has sold and what it still holds.
     *
     * @return one row per live product, ordered by product ID
     */
    public List<StockStatusReport> stockStatus() {
        // Current-state report: soft-deleted products are EXCLUDED (their stock is not operational).
        String sql = """
                SELECT p.id, p.name, p.sku,
                  COALESCE(SUM(CASE WHEN m.reason = 'SOLD' THEN m.quantity
                                    WHEN m.reason = 'RETURN_FROM_CUSTOMER' THEN -m.quantity
                                    ELSE 0 END), 0) AS sold_units,
                  COALESCE(SUM(CASE WHEN m.reason = 'SOLD' THEN m.quantity * m.sold_price
                                    WHEN m.reason = 'RETURN_FROM_CUSTOMER' THEN -m.quantity * m.sold_price
                                    ELSE 0 END), 0) AS sold_revenue,
                  p.quantity AS in_stock_units,
                  p.quantity * p.purchase_price AS in_stock_value
                FROM product p
                LEFT JOIN stock_movement m ON m.product_id = p.id
                WHERE p.deleted_at IS NULL
                GROUP BY p.id, p.name, p.sku, p.quantity, p.purchase_price
                ORDER BY p.id
                """;
        return jdbcClient.sql(sql).query((rs, rowNum) -> new StockStatusReport(rs.getLong("id"),
                rs.getString("name"), rs.getString("sku"), rs.getInt("sold_units"),
                rs.getBigDecimal("sold_revenue"), rs.getInt("in_stock_units"),
                rs.getBigDecimal("in_stock_value"))).list();
    }

    /**
     * Returns units written off as lost or destroyed over an optional period, valued at each
     * product's current purchase price.
     *
     * <p>The period is a closed range of movement dates, read the same way the profit report reads
     * them: a write-off counts when it was recorded on or between the two dates. Either bound may be
     * null, which leaves that end open.
     *
     * @param from first booking date to count, or {@code null} for no lower bound
     * @param to last booking date to count, or {@code null} for no upper bound
     * @return one row per product with at least one loss movement in the window, ordered by product ID
     */
    public List<LossReport> lossReport(LocalDate from, LocalDate to) {
        // Loss lines are valued at the product's CURRENT purchase price: pooled stock has no per-unit
        // cost, so this is a documented approximation consistent with the gross profit model.
        //
        // The window joins the reason filter rather than sitting in a WHERE clause, as in the profit
        // queries - but here it narrows the report rather than preserving zero rows, because this
        // join is an INNER one. That is the existing semantics continued, not a new decision: the
        // unwindowed query already lists only products that lost something, so a product that lost
        // nothing in the window has nothing to report and drops out exactly as one that never lost
        // anything does. A losses report lists losses.
        String sql = """
                SELECT p.id, p.name, p.sku, (p.deleted_at IS NOT NULL) AS deleted,
                  COALESCE(SUM(CASE WHEN m.reason = 'LOST' THEN m.quantity ELSE 0 END), 0) AS lost_units,
                  COALESCE(SUM(CASE WHEN m.reason = 'DESTROYED' THEN m.quantity ELSE 0 END), 0) AS destroyed_units,
                  SUM(m.quantity) * p.purchase_price AS loss_value
                FROM product p
                JOIN stock_movement m ON m.product_id = p.id AND m.reason IN ('LOST','DESTROYED')
                  AND (CAST(:from AS date) IS NULL OR m.created_at >= CAST(:from AS date))
                  AND (CAST(:to AS date) IS NULL OR m.created_at < CAST(:to AS date) + INTERVAL '1 day')
                GROUP BY p.id, p.name, p.sku, p.deleted_at, p.purchase_price
                ORDER BY p.id
                """;
        return jdbcClient.sql(sql)
                .param("from", from)
                .param("to", to)
                .query((rs, rowNum) -> new LossReport(rs.getLong("id"), rs.getString("name"),
                        rs.getString("sku"), rs.getBoolean("deleted"), rs.getInt("lost_units"),
                        rs.getInt("destroyed_units"), rs.getBigDecimal("loss_value")))
                .list();
    }

    /**
     * Returns write-offs grouped by the remark recorded against them.
     *
     * <p>The same losses {@link #lossReport} lists per product, re-aggregated by cause. The remark
     * taxonomy is shared by both write-off reasons precisely so this grouping is meaningful
     * (ADR 020); this method reads that decision rather than making one.
     *
     * @param from first booking date to count, or {@code null} for no lower bound
     * @param to last booking date to count, or {@code null} for no upper bound
     * @return one row per remark with at least one loss movement in the window, ordered by remark
     */
    public List<LossByRemark> lossesByRemark(LocalDate from, LocalDate to) {
        // Same valuation rule as lossReport - units at the product's CURRENT purchase price - but
        // multiplied per row rather than once per group: that query groups by product, so one price
        // applies to the whole sum, while this one spans products and each row carries its own.
        //
        // Same date-window handling too, and the same absent-not-zeroed contract: the reason filter
        // sits in the WHERE clause and a remark nobody used in the window simply has no row. A
        // losses report lists losses, and the caller learns nothing from a row of zeroes.
        String sql = """
                SELECT m.movement_remark AS remark,
                  COALESCE(SUM(CASE WHEN m.reason = 'LOST' THEN m.quantity ELSE 0 END), 0) AS lost_units,
                  COALESCE(SUM(CASE WHEN m.reason = 'DESTROYED' THEN m.quantity ELSE 0 END), 0) AS destroyed_units,
                  SUM(m.quantity * p.purchase_price) AS loss_value
                FROM stock_movement m
                JOIN product p ON p.id = m.product_id
                WHERE m.reason IN ('LOST','DESTROYED')
                  AND (CAST(:from AS date) IS NULL OR m.created_at >= CAST(:from AS date))
                  AND (CAST(:to AS date) IS NULL OR m.created_at < CAST(:to AS date) + INTERVAL '1 day')
                GROUP BY m.movement_remark
                ORDER BY m.movement_remark
                """;
        // The product join carries no deleted_at filter, as in lossReport: a write-off happened
        // whether or not the product was retired afterwards, and dropping it would quietly shrink
        // a historical total.
        return jdbcClient.sql(sql)
                .param("from", from)
                .param("to", to)
                .query((rs, rowNum) -> new LossByRemark(rs.getString("remark"), rs.getInt("lost_units"),
                        rs.getInt("destroyed_units"), rs.getBigDecimal("loss_value")))
                .list();
    }

    /**
     * Returns what one customer has bought and returned across its booked sale invoices.
     *
     * <p>Anonymous cash sales name no customer by construction, so they belong to no summary and are
     * invisible here.
     *
     * @param customerId customer identifier
     * @return the customer's summary, zero-filled if it has no booked sales, or empty if no such
     *         customer exists; a soft-deleted customer still reports, flagged as deleted
     */
    public Optional<CustomerSummary> customerSummary(long customerId) {
        // The invoice restriction lives in the JOIN condition, not in WHERE: moving it out would drop the
        // customer's own row whenever it has no booked sale, turning a zero-filled summary into "no such
        // customer". Soft-deleted invoices need no exclusion here - only OPEN invoices can be deleted, and
        // OPEN is already excluded.
        String sql = """
                SELECT c.id, c.name, (c.deleted_at IS NOT NULL) AS deleted,
                  COUNT(DISTINCT i.id) AS sale_invoice_count,
                  COALESCE(SUM(ii.quantity), 0) AS bought_units,
                  COALESCE(SUM(ii.quantity * ii.unit_price), 0) AS bought_value,
                  COALESCE(SUM(ii.returned_qty), 0) AS returned_units,
                  COALESCE(SUM(ii.returned_qty * ii.unit_price), 0) AS returned_value
                FROM customer c
                LEFT JOIN invoice i
                  ON i.customer_id = c.id AND i.invoice_type = 'SALE' AND i.status <> 'OPEN'
                LEFT JOIN invoice_item ii ON ii.invoice_id = i.id
                WHERE c.id = :id
                GROUP BY c.id, c.name, c.deleted_at
                """;
        return jdbcClient.sql(sql).param("id", customerId).query(CUSTOMER_SUMMARY_MAPPER).optional();
    }

    /**
     * Returns unpaid invoices grouped by due date and invoice type.
     *
     * @return one bucket per due date and type, ordered by due date
     */
    public List<DueDateBucket> dueDateBuckets() {
        // Unpaid, live invoices only; FULLY_RETURNED is excluded because nothing is owed on it.
        // Outstanding value nets out returned quantities.
        String sql = """
                SELECT i.due_date, i.invoice_type, COUNT(*) AS invoice_count,
                  COALESCE(SUM(t.outstanding), 0) AS total_value
                FROM invoice i
                """
                + OUTSTANDING_SUBQUERY
                + """
                WHERE i.paid_at IS NULL AND i.deleted_at IS NULL AND i.status <> 'FULLY_RETURNED'
                GROUP BY i.due_date, i.invoice_type
                ORDER BY i.due_date
                """;
        return jdbcClient.sql(sql).query((rs, rowNum) -> new DueDateBucket(
                rs.getObject("due_date", LocalDate.class), rs.getString("invoice_type"),
                rs.getLong("invoice_count"), rs.getBigDecimal("total_value"))).list();
    }

    /**
     * Returns unpaid invoices falling due within the given window.
     *
     * @param days size of the window in days from today
     * @return the matching invoices, ordered by due date
     */
    public List<InvoiceDueSummary> dueSoon(int days) {
        String sql = """
                SELECT i.id, i.invoice_number, i.invoice_type, COALESCE(s.name, c.name) AS counterparty,
                  i.due_date, t.outstanding
                FROM invoice i
                LEFT JOIN supplier s ON s.id = i.supplier_id
                LEFT JOIN customer c ON c.id = i.customer_id
                """
                + OUTSTANDING_SUBQUERY
                + """
                WHERE i.paid_at IS NULL AND i.deleted_at IS NULL AND i.status <> 'FULLY_RETURNED'
                  AND i.due_date <= CURRENT_DATE + :days
                ORDER BY i.due_date
                """;
        return jdbcClient.sql(sql).param("days", days).query(DUE_SOON_MAPPER).list();
    }

    /**
     * Returns invoices that are booked, unpaid and past their due date.
     *
     * @return the overdue invoices with how many days each is late, ordered by due date
     */
    public List<InvoiceDueSummary> overdue() {
        // The derived overdue predicate: booked (CLOSED), unpaid, past due. Never stored.
        String sql = """
                SELECT i.id, i.invoice_number, i.invoice_type, COALESCE(s.name, c.name) AS counterparty,
                  i.due_date, t.outstanding, (CURRENT_DATE - i.due_date) AS days_overdue
                FROM invoice i
                LEFT JOIN supplier s ON s.id = i.supplier_id
                LEFT JOIN customer c ON c.id = i.customer_id
                """
                + OUTSTANDING_SUBQUERY
                + """
                WHERE i.status = 'CLOSED' AND i.paid_at IS NULL AND i.deleted_at IS NULL
                  AND i.due_date < CURRENT_DATE
                ORDER BY i.due_date
                """;
        return jdbcClient.sql(sql).query(OVERDUE_MAPPER).list();
    }

    /**
     * Returns money in and out over an optional payment period, overall and per product.
     *
     * <p>Payment basis: an invoice counts on the date it was paid, so booked-but-unpaid invoices are
     * invisible here whatever the period. Each line contributes its quantity net of returns at the
     * line's own price snapshot.
     *
     * @param from first payment date to count, or {@code null} for no lower bound
     * @param to last payment date to count, or {@code null} for no upper bound
     * @return the totals and the per-product rows, ordered by net descending
     */
    public CashFlowReport cashFlow(LocalDate from, LocalDate to) {
        String sql = "SELECT p.id, p.name, p.sku, (p.deleted_at IS NOT NULL) AS deleted,\n"
                + CASH_FLOW_INFLOW + " AS inflow,\n"
                + CASH_FLOW_OUTFLOW + " AS outflow\n"
                + CASH_FLOW_SOURCE
                + "GROUP BY p.id, p.name, p.sku, p.deleted_at\n"
                + "ORDER BY (" + CASH_FLOW_INFLOW + " - " + CASH_FLOW_OUTFLOW + ") DESC, p.id\n";
        List<CashFlowProductRow> products = jdbcClient.sql(sql)
                .param("from", from)
                .param("to", to)
                .query(CASH_FLOW_MAPPER)
                .list();

        // Summed from the rows rather than fetched by a second aggregate query: every invoice line
        // names a product, so the rows already account for every cent the query matched.
        BigDecimal inflow = products.stream().map(CashFlowProductRow::inflow)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal outflow = products.stream().map(CashFlowProductRow::outflow)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new CashFlowReport(inflow, outflow, inflow.subtract(outflow), products);
    }

    /**
     * Returns money in and out per calendar month over an optional payment period.
     *
     * <p>The same payment basis, the same net-of-returns line value and the same window as
     * {@link #cashFlow}, regrouped by the month an invoice was paid in rather than by product.
     *
     * @param from first payment date to count, or {@code null} for no lower bound
     * @param to last payment date to count, or {@code null} for no upper bound
     * @return one bucket per month that moved money, oldest first
     */
    public List<CashFlowTimelineBucket> cashFlowTimeline(LocalDate from, LocalDate to, Long productId) {
        // A month nothing was paid in produces no bucket rather than a zero one. Generating the empty
        // months would need a date series bounded by the open-ended window this endpoint accepts, and
        // the chart plots the categories it is handed - so an idle month is a gap in the axis, which
        // is what an idle month is. Scoping to a product only narrows which lines are counted, so a
        // product with a quiet month has a gap there for the same reason the whole business does.
        String sql = "SELECT to_char(date_trunc('month', i.paid_at), 'YYYY-MM') AS month,\n"
                + CASH_FLOW_INFLOW + " AS inflow,\n"
                + CASH_FLOW_OUTFLOW + " AS outflow\n"
                + CASH_FLOW_SOURCE
                + CASH_FLOW_PRODUCT_FILTER
                + "GROUP BY date_trunc('month', i.paid_at)\n"
                + "ORDER BY date_trunc('month', i.paid_at)\n";
        return jdbcClient.sql(sql)
                .param("from", from)
                .param("to", to)
                .param("productId", productId)
                .query(CASH_FLOW_TIMELINE_MAPPER)
                .list();
    }

    /**
     * Reports whether a product row exists at all, soft-deleted or not.
     *
     * <p>Native for the same reason {@link #stockHistory} is: {@code @SQLRestriction} hides retired
     * products from every mapped query, and a report asked about one should 404 only when there is
     * no such product, never because it has since been retired.
     *
     * @param productId product identifier
     * @return {@code true} if a product row carries that identifier
     */
    public boolean productExists(long productId) {
        return jdbcClient.sql("SELECT 1 FROM product WHERE id = :id")
                .param("id", productId)
                .query(Integer.class)
                .optional()
                .isPresent();
    }

    /**
     * Searches the products one supplier has sold this business, by a case-insensitive name match.
     *
     * <p>Discovery follows the supply relationship rather than the catalogue: the caller has already
     * named a supplier, and the useful next question is which of that supplier's products they mean.
     * See {@link #SUPPLIER_PRODUCT_SEARCH} for how the linkage is drawn and why a product bought from
     * two suppliers answers under both.
     *
     * @param supplierId supplier identifier
     * @param name search substring (case-insensitive)
     * @return the supplier's matching products, alphabetical, capped for typeahead use; empty if the
     *         supplier has bought nothing matching, or empty optional if no such live supplier exists
     */
    public Optional<List<SupplierProduct>> supplierProducts(long supplierId, String name) {
        // Mapped-query semantics on purpose, unlike the product check above: this list is a picker,
        // and a soft-deleted supplier is not one to start a new enquiry against.
        Integer found = jdbcClient.sql("SELECT 1 FROM supplier WHERE id = :id AND deleted_at IS NULL")
                .param("id", supplierId)
                .query(Integer.class)
                .optional()
                .orElse(null);
        if (found == null) {
            return Optional.empty();
        }
        return Optional.of(jdbcClient.sql(SUPPLIER_PRODUCT_SEARCH)
                .param("supplierId", supplierId)
                .param("name", name)
                .param("limit", SearchLimits.TYPEAHEAD_LIMIT)
                .query(SUPPLIER_PRODUCT_MAPPER)
                .list());
    }
}
